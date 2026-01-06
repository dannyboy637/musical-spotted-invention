# Restaurant Analytics Platform

**Turn your POS data into actionable insights.** A powerful analytics dashboard built for restaurant owners who want to understand their business performance, optimize their menu, and increase profitability.

![Dashboard Overview](docs/screenshots/dashboard.png)

## Features

### Executive Dashboard
Get a bird's-eye view of your restaurant's performance with real-time KPIs including revenue, transactions, average ticket size, and growth metrics.

### Menu Engineering
Analyze your menu using the BCG Matrix methodology. Identify your Stars (high profit, high popularity), Plowhorses (need price optimization), Puzzles (need better marketing), and Dogs (consider removing).

![Menu Engineering](docs/screenshots/menu-engineering.png)

### Time Intelligence
Understand when your restaurant performs best. Analyze sales by:
- Daypart (breakfast, lunch, dinner, late night)
- Day of week patterns
- Hourly heatmaps
- Year-over-year comparisons

![Time Analysis](docs/screenshots/time-intelligence.png)

### Performance Trends
Track your restaurant's trajectory with daily, weekly, and monthly trend charts. Includes 7-day moving averages for smoothed insights.

### Branch Comparison
For multi-location restaurants, compare performance across branches and identify best practices from your top performers.

### Smart Alerts
Get notified when something needs attention:
- Revenue drops compared to previous periods
- Item performance spikes or crashes
- Menu engineering quadrant changes

### Automated Reports
Generate and send branded weekly reports to stakeholders with AI-powered narrative summaries.

## How It Works

1. **Export your data** - Export CSV files from your POS system (StoreHub supported, others coming soon)
2. **Import to platform** - Upload your transaction data through our simple import tool
3. **Get insights** - Explore your analytics dashboard with automatic categorization and analysis

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, Python |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth with JWT |

## Security

- **Multi-tenant isolation** - Row-Level Security ensures your data is only visible to you
- **Rate limiting** - API protection against abuse (100 req/min)
- **Encrypted connections** - HTTPS everywhere
- **Role-based access** - Owner, Viewer, and Operator roles

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase account

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/restaurant-analytics.git
cd restaurant-analytics

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configure your environment
uvicorn main:app --reload

# Frontend setup (new terminal)
cd frontend
npm install
cp .env.example .env  # Configure your environment
npm run dev
```

Visit `http://localhost:5173` to see the app.

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API.md) | Complete API documentation |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment instructions |
| [Current Context](docs/CURRENT_CONTEXT.md) | Development status |

## Screenshots

<details>
<summary>View all screenshots</summary>

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Menu Engineering
![Menu Engineering](docs/screenshots/menu-engineering.png)

### Time Intelligence
![Time Analysis](docs/screenshots/time-intelligence.png)

### Reports
![Reports](docs/screenshots/reports.png)

</details>

## Support

For questions or issues, please [open an issue](https://github.com/your-org/restaurant-analytics/issues) on GitHub.

## License

Proprietary - All rights reserved.
