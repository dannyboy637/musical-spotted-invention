import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useUploadCSV, useImportJob } from '../../hooks/useDataManagement'
import { useQueryClient } from '@tanstack/react-query'

type UploadState = 'idle' | 'selected' | 'uploading' | 'processing' | 'completed' | 'failed'

export function CSVUploadForm() {
  const [state, setState] = useState<UploadState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const uploadMutation = useUploadCSV()

  // Poll job status while processing
  const { data: jobData } = useImportJob(activeJobId, {
    refetchInterval: state === 'processing' ? 2000 : false,
  })

  // Update state based on job status
  if (jobData && state === 'processing') {
    if (jobData.status === 'completed') {
      setState('completed')
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-menu-engineering'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
    } else if (jobData.status === 'failed') {
      setState('failed')
      setError(jobData.error_message || 'Import failed')
    }
  }

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

    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }, [])

  const validateAndSetFile = (file: File) => {
    setError(null)

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File size must be less than 50MB')
      return
    }

    setSelectedFile(file)
    setState('selected')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setState('uploading')
    setError(null)

    try {
      const result = await uploadMutation.mutateAsync(selectedFile)
      setActiveJobId(result.job_id)
      setState('processing')
    } catch (err) {
      setState('failed')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const handleReset = () => {
    setState('idle')
    setSelectedFile(null)
    setActiveJobId(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getProgress = () => {
    if (!jobData?.total_rows || !jobData?.processed_rows) return 0
    return Math.round((jobData.processed_rows / jobData.total_rows) * 100)
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Upload CSV Data</h2>

      {state === 'idle' && (
        <>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-gold-500 bg-gold-50'
                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">
              Drag and drop your CSV file here
            </p>
            <p className="text-xs text-slate-500 mt-1">or click to browse</p>
            <p className="text-xs text-slate-400 mt-3">Supported: StoreHub CSV format</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </>
      )}

      {state === 'selected' && selectedFile && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
            <FileText className="w-8 h-8 text-slate-500" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 truncate">{selectedFile.name}</p>
              <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              onClick={handleReset}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle size={20} />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              className="flex-1 px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium"
            >
              Upload and Process
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(state === 'uploading' || state === 'processing') && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div className="flex-1">
              <p className="font-medium text-blue-800">
                {state === 'uploading' ? 'Uploading...' : 'Processing...'}
              </p>
              {state === 'processing' && jobData && (
                <p className="text-sm text-blue-600">
                  {jobData.processed_rows?.toLocaleString() || 0} / {jobData.total_rows?.toLocaleString() || '?'} rows
                  {jobData.total_rows && ` (${getProgress()}%)`}
                </p>
              )}
            </div>
          </div>
          {state === 'processing' && jobData?.total_rows && (
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          )}
        </div>
      )}

      {state === 'completed' && jobData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <div className="flex-1">
              <p className="font-medium text-emerald-800">Import Complete</p>
              <p className="text-sm text-emerald-600">
                {jobData.inserted_rows?.toLocaleString()} rows imported
                {jobData.skipped_rows ? `, ${jobData.skipped_rows.toLocaleString()} skipped` : ''}
              </p>
              {jobData.date_range_start && jobData.date_range_end && (
                <p className="text-sm text-emerald-600">
                  Data range: {new Date(jobData.date_range_start).toLocaleDateString()} - {new Date(jobData.date_range_end).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Upload Another File
          </button>
        </div>
      )}

      {state === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
            <XCircle className="w-6 h-6 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Import Failed</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {error && state === 'idle' && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
