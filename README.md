# Retail Demand Intelligence

End-to-end retail demand forecasting system built on the M5 Walmart dataset. Forecasts 28-day SKU demand, estimates stockout risk, generates LLM-powered inventory narratives, and surfaces SHAP-based explainability — all served through a FastAPI backend and Next.js dashboard.

## Live Demo

| Component | URL |
|-----------|-----|
| Frontend | _deploy in progress_ |
| API | _deploy in progress_ |
| API Docs | `<api-url>/docs` |

## Architecture

```
M5 Walmart Dataset (30,490 SKUs × 5 years)
        ↓
[ML Pipeline] — feature engineering, Prophet + LightGBM ensemble, WRMSSE evaluation
        ↓
[Inventory Engine] — ROP, safety stock, EOQ, stockout timeline
        ↓
[LLM Insight Layer] — Groq / OpenAI / Anthropic / Gemini (provider-agnostic)
        ↓
FastAPI ──► Next.js 15 Dashboard
```

## ML Model

- **Features:** lag-1/3/7/14/28/56/364d, rolling mean/std 7/28d, store-level aggregates, SNAP flags (state-matched), calendar events (cultural/national/religious/sporting), hierarchy categoricals (dept, category, state), price momentum
- **Models:** Prophet per SKU (weekly + yearly seasonality, US holidays) + global LightGBM (Tweedie loss) ensemble
- **Evaluation:** WRMSSE (M5 standard) — current val score **0.6436** on 500-SKU sample
- **MLflow:** every run tracked with params, metrics, SHAP importance, backtest artifacts

## Stack

| Layer | Technology |
|-------|-----------|
| Forecasting | Prophet + LightGBM |
| Feature engineering | pandas + numpy |
| Experiment tracking | MLflow |
| Explainability | SHAP |
| API | FastAPI + uvicorn |
| LLM | Groq (Llama 3.3 70B) / OpenAI / Anthropic / Gemini |
| Frontend | Next.js 15 + shadcn/ui + Recharts |
| Deploy | Railway (API) + Vercel (frontend) |

## Quick Start (local)

```bash
git clone <repo-url>
cd retail-demand-intelligence
pip install -r requirements.txt

# Download M5 data (requires Kaggle account)
kaggle competitions download -c m5-forecasting-accuracy -p data/raw/
unzip data/raw/m5-forecasting-accuracy.zip -d data/raw/

# Train model (500 SKUs ~8 min, 2000 SKUs ~35 min)
python3 -m ml.train --sku-sample 500

# Start API
uvicorn api.main:app --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## LLM Setup

Copy `.env.example` to `.env` and add your key:

```bash
cp .env.example .env
# Edit .env — set LLM_PROVIDER and the matching API key
```

Supported providers: `groq` (default, free tier), `openai`, `anthropic`, `gemini`.

The frontend also supports **Bring Your Own Key** — enter your API key in the UI, stored in localStorage only, never sent to the server.

## Deploy

### Railway (API)

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up
```

Set environment variables in Railway dashboard: `LLM_PROVIDER`, `GROQ_API_KEY` (or other provider key), `MLFLOW_TRACKING_URI` (optional).

### Vercel (Frontend)

```bash
cd frontend
vercel --prod
```

Set `NEXT_PUBLIC_API_URL` to your Railway API URL.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + ML availability |
| GET | `/metrics` | Latest run WRMSSE, RMSE, SHAP importance |
| GET | `/forecast/{sku_id}` | 28-day demand forecast + inventory state |
| GET | `/inventory` | All SKUs ranked by stockout risk |
| POST | `/insights` | LLM narrative for a single SKU |
| POST | `/insights/refresh` | Batch-generate insights for top at-risk SKUs |

## Repo Structure

```
retail-demand-intelligence/
├── ml/
│   ├── pipeline.py       # Feature engineering + train/val split
│   ├── forecasting.py    # Prophet + LightGBM + ensemble utilities
│   ├── inventory.py      # ROP, safety stock, EOQ
│   ├── predict.py        # Inference pipeline
│   └── train.py          # Training entrypoint
├── api/
│   ├── main.py           # FastAPI routes
│   └── llm_client.py     # Provider-agnostic LLM abstraction
├── frontend/             # Next.js dashboard
├── config/
│   └── inventory_params.json  # Per-category inventory defaults
├── docs/
│   └── 2026-05-19-design.md
├── Dockerfile
├── railway.toml
├── docker-compose.yml
└── requirements.txt
```

## Notes

- M5 dataset lacks real inventory levels — synthetic starting stock seeded from historical sales patterns
- WRMSSE uses a simplified global scale (not full M5 hierarchy/dollar weighting)
- Prophet training is slow per-SKU (~1 min each); LightGBM is global and fast
