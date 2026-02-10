import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { useUploadCSV, useImportJob, useCancelImportJob } from '../../hooks/useDataManagement'
import { useQueryClient } from '@tanstack/react-query'

type FileStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'

interface FileItem {
  id: string
  file: File
  status: FileStatus
  uploadProgress: number
  jobId: string | null
  error: string | null
  insertedRows: number | null
}

export function CSVUploadForm() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [currentFileId, setCurrentFileId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const uploadMutation = useUploadCSV((progress) => setUploadProgress(progress))
  const cancelMutation = useCancelImportJob()

  // Get current processing file's job for polling
  const currentFile = files.find(f => f.id === currentFileId)
  const { data: jobData } = useImportJob(currentFile?.jobId || null, {
    refetchInterval: currentFile?.status === 'processing' ? 2000 : false,
  })

  // Handle job completion/failure
  useEffect(() => {
    if (!jobData || !currentFile || currentFile.status !== 'processing') return

    if (jobData.status === 'completed') {
      // Check if this was mostly duplicates (0 or very few inserted)
      const duplicateCount = jobData.error_details?.duplicate_skipped || 0
      const wasAllDuplicates = (jobData.inserted_rows === 0 || jobData.inserted_rows === null) && duplicateCount > 0

      setFiles(prev => prev.map(f =>
        f.id === currentFileId
          ? {
              ...f,
              status: 'completed' as FileStatus,
              insertedRows: jobData.inserted_rows,
              // Show duplicate warning as a soft error message
              error: wasAllDuplicates
                ? `All ${duplicateCount.toLocaleString()} rows already existed (duplicates skipped)`
                : duplicateCount > 0
                  ? `${duplicateCount.toLocaleString()} duplicates skipped`
                  : null
            }
          : f
      ))
      setCurrentFileId(null) // Will trigger next file via another effect
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-menu-engineering'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
    } else if (jobData.status === 'failed') {
      setFiles(prev => prev.map(f =>
        f.id === currentFileId
          ? { ...f, status: 'failed' as FileStatus, error: jobData.error_message || 'Processing failed' }
          : f
      ))
      setCurrentFileId(null) // Will trigger next file via another effect
    } else if (jobData.status === 'cancelled') {
      // Handle external cancellation (e.g., from ImportHistoryTable or stale cleanup)
      setFiles(prev => prev.map(f =>
        f.id === currentFileId
          ? { ...f, status: 'failed' as FileStatus, error: 'Import was cancelled' }
          : f
      ))
      setCurrentFileId(null) // Will trigger next file via another effect
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to status changes, not full object refs
  }, [jobData?.status, currentFileId, currentFile?.status, queryClient])

  // Auto-start next pending file when current one finishes
  useEffect(() => {
    if (currentFileId === null) {
      const pendingFile = files.find(f => f.status === 'pending')
      if (pendingFile && files.some(f => f.status === 'completed' || f.status === 'failed')) {
        // Only auto-continue if we've already started processing
        uploadFileById(pendingFile.id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- uploadFileById is unstable; only re-run on file list/current changes
  }, [currentFileId, files])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- addFiles is unstable; drag handler only needs stable identity
  }, [])

  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith('.csv')) {
      return `${file.name}: Only CSV files are accepted`
    }
    if (file.size > 250 * 1024 * 1024) {
      return `${file.name}: File size must be less than 250MB`
    }
    return null
  }

  const addFiles = (newFiles: File[]) => {
    setGlobalError(null)
    const errors: string[] = []
    const validFiles: FileItem[] = []

    newFiles.forEach(file => {
      const error = validateFile(file)
      if (error) {
        errors.push(error)
      } else {
        // Check for duplicates
        const isDuplicate = files.some(f => f.file.name === file.name && f.file.size === file.size)
        if (!isDuplicate) {
          validFiles.push({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            status: 'pending',
            uploadProgress: 0,
            jobId: null,
            error: null,
            insertedRows: null,
          })
        }
      }
    })

    if (errors.length > 0) {
      setGlobalError(errors.join('\n'))
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles)
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const uploadFileById = async (fileId: string) => {
    const fileItem = files.find(f => f.id === fileId)
    if (!fileItem) return

    setCurrentFileId(fileId)
    setUploadProgress(0)
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, status: 'uploading', uploadProgress: 0 } : f
    ))

    try {
      const result = await uploadMutation.mutateAsync(fileItem.file)
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'processing', jobId: result.job_id, uploadProgress: 100 } : f
      ))
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'failed', error: err instanceof Error ? err.message : 'Upload failed' } : f
      ))
      // Setting null will trigger the effect to start next file
      setCurrentFileId(null)
    }
  }

  const handleUploadAll = () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length > 0) {
      uploadFileById(pendingFiles[0].id)
    }
  }

  const handleReset = () => {
    setFiles([])
    setCurrentFileId(null)
    setGlobalError(null)
    setUploadProgress(0)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const completedCount = files.filter(f => f.status === 'completed').length
  const failedCount = files.filter(f => f.status === 'failed').length
  const isProcessing = files.some(f => f.status === 'uploading' || f.status === 'processing')
  const allDone = files.length > 0 && !isProcessing && pendingCount === 0

  // Warn user before leaving page during upload (browser close/refresh)
  useEffect(() => {
    if (isProcessing) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = 'Upload in progress. Are you sure you want to leave?'
        return e.returnValue
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isProcessing])

  // Intercept in-app navigation (sidebar clicks) during upload
  useEffect(() => {
    if (!isProcessing) return

    const handleClick = (e: MouseEvent) => {
      // Find if click was on a link or inside a link
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link && link.href && !link.href.startsWith('javascript:')) {
        // Check if it's an internal link (same origin)
        const url = new URL(link.href, window.location.origin)
        if (url.origin === window.location.origin) {
          e.preventDefault()
          e.stopPropagation()

          const shouldLeave = window.confirm(
            'Upload in progress. Are you sure you want to leave?\n\nLeaving will cancel the current upload.'
          )

          if (shouldLeave) {
            // Cancel the job before navigating
            if (currentFile?.jobId) {
              cancelMutation.mutate(currentFile.jobId)
            }
            // Navigate after a brief delay to allow cancel request to send
            setTimeout(() => {
              window.location.href = link.href
            }, 100)
          }
        }
      }
    }

    // Capture phase to intercept before React Router handles it
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, currentFile?.jobId])

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy-900">Upload CSV Data</h2>
        {files.length > 0 && (
          <span className="text-sm text-slate-500">
            {completedCount}/{files.length} completed
            {failedCount > 0 && <span className="text-red-500"> ({failedCount} failed)</span>}
          </span>
        )}
      </div>

      {/* Warning banner when processing */}
      {isProcessing && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Upload in progress. Please don't leave this page until complete.
          </p>
        </div>
      )}

      {/* Drop zone - always visible when not processing */}
      {!isProcessing && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4 ${
            dragActive
              ? 'border-gold-500 bg-gold-50'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">
            Drag and drop CSV files here
          </p>
          <p className="text-xs text-slate-500 mt-1">or click to browse (multiple files supported)</p>
          <p className="text-xs text-slate-400 mt-2">Max 250MB per file</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2 mb-4">
          {files.map((fileItem) => (
            <div
              key={fileItem.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                fileItem.status === 'completed' && fileItem.insertedRows === 0 ? 'bg-amber-50 border-amber-200' :
                fileItem.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                fileItem.status === 'failed' ? 'bg-red-50 border-red-200' :
                fileItem.status === 'uploading' || fileItem.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                'bg-slate-50 border-slate-200'
              }`}
            >
              {/* Status icon */}
              {fileItem.status === 'completed' && fileItem.insertedRows === 0 && (
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              )}
              {fileItem.status === 'completed' && (fileItem.insertedRows ?? 0) > 0 && (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              )}
              {fileItem.status === 'failed' && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
              {(fileItem.status === 'uploading' || fileItem.status === 'processing') && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              )}
              {fileItem.status === 'pending' && <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{fileItem.file.name}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">{formatFileSize(fileItem.file.size)}</span>
                  {fileItem.status === 'uploading' && (
                    <span className="text-blue-600">Uploading {uploadProgress}%</span>
                  )}
                  {fileItem.status === 'processing' && (
                    <span className="text-blue-600">Processing...</span>
                  )}
                  {fileItem.status === 'completed' && (
                    <>
                      {fileItem.insertedRows !== null && fileItem.insertedRows > 0 && (
                        <span className="text-emerald-600">{fileItem.insertedRows.toLocaleString()} rows imported</span>
                      )}
                      {fileItem.insertedRows === 0 && fileItem.error && (
                        <span className="text-amber-600">{fileItem.error}</span>
                      )}
                      {fileItem.insertedRows !== null && fileItem.insertedRows > 0 && fileItem.error && (
                        <span className="text-amber-600 ml-1">• {fileItem.error}</span>
                      )}
                    </>
                  )}
                  {fileItem.status === 'failed' && fileItem.error && (
                    <span className="text-red-600">{fileItem.error}</span>
                  )}
                </div>

                {/* Progress bar for uploading */}
                {fileItem.status === 'uploading' && (
                  <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Remove button (only for pending files) */}
              {fileItem.status === 'pending' && (
                <button
                  onClick={() => removeFile(fileItem.id)}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {files.length > 0 && pendingCount > 0 && !isProcessing && (
        <div className="flex gap-3">
          <button
            onClick={handleUploadAll}
            className="flex-1 px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium"
          >
            Upload {pendingCount} {pendingCount === 1 ? 'File' : 'Files'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}

      {/* All done state */}
      {allDone && (
        <button
          onClick={handleReset}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Upload More Files
        </button>
      )}

      {/* Global error message */}
      {globalError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 whitespace-pre-line">{globalError}</p>
        </div>
      )}
    </div>
  )
}
