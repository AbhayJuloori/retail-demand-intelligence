# Retail Demand Intelligence

End-to-end inventory forecasting system built on the [M5 Walmart dataset](https://www.kaggle.com/competitions/m5-forecasting-accuracy). Trains a **Prophet + LightGBM ensemble** across 2,000 SKU-store series, runs an inventory engine to compute reorder points and stockout risk, and serves everything through a fully static Next.js dashboard with LLM-generated plain-language insights.

**Live demo:** [abhayjuloori.github.io/retail-demand-intelligence](https://abhayjuloori.github.io/retail-demand-intelligence)

---

## What it does

| Feature | Details |
|---|---|
| **Demand forecasting** | 28-day rolling forecast per SKU using a blended Prophet + LightGBM model |
| **Stockout risk** | Days-to-stockout, reorder point, safety stock, EOQ — computed from forecasted demand |
| **LLM insights** | Plain-English inventory narratives generated via Groq (llama-3.3-70b) — runs directly from the browser, no backend required |
| **Model explainability** | SHAP feature importance tracked per training run in MLflow |
| **Static dashboard** | Next.js 15 static export, deployable to GitHub Pages — no server needed for the UI |

---

## Model performance

The ensemble achieves **WRMSSE 0.636** on a 2,000-SKU validation sample:

| Model | WRMSSE | Notes |
|---|---|---|
| Seasonal naïve (baseline) | 1.00 | Repeat last year's pattern, no ML |
| Simple LightGBM | 0.72 | Single model, raw lag features, no tuning |
| **This model (Prophet + LightGBM)** | **0.636** | Ensemble, 2,000-SKU sample |
| Well-tuned LightGBM (full dataset) | 0.60 | Hyperparameter search, 30k SKUs |
| M5 competition top 10% | 0.57 | Kaggle leaderboard |
| M5 competition winner | 0.50 | Best known result |

WRMSSE is the official M5 competition metric. A score of 1.0 = no better than naïve seasonal repeat; lower is better. This model cuts error **36% below baseline** — competitive with a well-tuned single-model approach on the full dataset despite being trained on only ~7% of the available series.

---

## Architecture

```
M5 Walmart Dataset (30,490 SKUs × 5 years of daily sales)
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  Feature Engineering (ml/pipeline.py)                │
│  lag-1/7/14/28/364d · rolling mean/std · SNAP flags  │
│  calendar events · price momentum · hierarchy cats   │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────┐    ┌──────────────────────┐
│  Prophet (per SKU) │    │  LightGBM (global)   │
│  weekly + yearly   │    │  Tweedie loss · all  │
│  seasonality       │    │  SKUs in one model   │
└────────────────────┘    └──────────────────────┘
        │                          │
        └────────────┬─────────────┘
                     │ blended ensemble (learned weights)
                     ▼
        ┌─────────────────────────┐
        │  Inventory Engine       │
        │  ml/inventory.py        │
        │  ROP · safety stock     │
        │  EOQ · stockout days    │
        └─────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  FastAPI backend        │    ◄── optional (dashboard is fully static)
        │  /forecast · /inventory │
        │  /insights · /metrics   │
        └─────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  Next.js 15 dashboard   │
        │  static export →        │
        │  GitHub Pages           │
        └─────────────────────────┘
```

---

## Dashboard pages

**Overview** — KPI strip (stockout imminent / at risk / healthy), animated risk distribution bar, filterable inventory table sorted by urgency.

**SKU Explorer** — drill into any SKU: status header, 4 inventory metrics (current stock, safety stock, ROP, EOQ), 28-day demand forecast chart.

**Insight Feed** — connect a Groq API key (free, runs browser-side) to get 2–3 sentence plain-English narratives for your highest-risk SKUs — what's driving the risk, the specific timing, and the exact order quantity.

**Model Metrics** — WRMSSE explained, benchmark comparison table, SHAP bar chart, training dataset breakdown.

---

## Stack

| Layer | Technology |
|---|---|
| ML — forecasting | Prophet + LightGBM (Tweedie) ensemble |
| ML — experiment tracking | MLflow |
| ML — explainability | SHAP |
| Feature engineering | pandas, numpy |
| Inventory math | custom (ROP, safety stock, EOQ) |
| API | FastAPI + uvicorn |
| LLM | Groq llama-3.3-70b (browser-direct via CORS) |
| Frontend | Next.js 15, Tailwind CSS, Recharts |
| Deployment | GitHub Pages (frontend), Railway (API) |

---

## Local setup

**Prerequisites:** Python 3.11+, Node 20+, a [Kaggle account](https://www.kaggle.com/) for the dataset.

```bash
git clone https://github.com/AbhayJuloori/retail-demand-intelligence
cd retail-demand-intelligence

# Python environment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Download M5 data
kaggle competitions download -c m5-forecasting-accuracy -p data/raw/
unzip "data/raw/m5-forecasting-accuracy.zip" -d data/raw/

# Train (500 SKUs ≈ 8 min, 2000 SKUs ≈ 35 min)
python -m ml.train --sku-sample 500

# API server
uvicorn api.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev          # dev server at http://localhost:3000
```

**Environment variables** — copy `.env.example` to `.env`:

```
LLM_PROVIDER=groq          # groq | openai | anthropic | gemini
GROQ_API_KEY=gsk_...
```

The dashboard also supports **Bring Your Own Key** — enter a Groq API key in the Insight Feed UI. It's stored in localStorage only and goes directly from your browser to Groq's API.

---

## API reference

```
GET  /health                    health check + model availability
GET  /metrics                   WRMSSE, RMSE, SHAP importance, run metadata
GET  /forecast/{sku_id}         28-day forecast + inventory state for one SKU
GET  /inventory?limit=N         all SKUs ranked by stockout risk
POST /insights                  LLM narrative for a single SKU
POST /insights/refresh          batch-generate insights for top at-risk SKUs
```

Interactive docs available at `/docs` when the API is running.

---

## Repo structure

```
retail-demand-intelligence/
├── ml/
│   ├── pipeline.py       # feature engineering, train/val split
│   ├── forecasting.py    # Prophet + LightGBM, ensemble utilities
│   ├── inventory.py      # reorder point, safety stock, EOQ
│   ├── predict.py        # inference pipeline
│   └── train.py          # CLI entrypoint
├── api/
│   ├── main.py           # FastAPI routes, inventory cache
│   └── llm_client.py     # provider-agnostic LLM abstraction
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js app router
│   │   ├── components/   # ForecastChart, SHAPChart, Sidebar
│   │   ├── views/        # Overview, SKUExplorer, InsightsFeed, ModelMetrics
│   │   └── lib/          # types, demo data, static metrics
│   └── next.config.js    # static export config
├── config/
│   └── inventory_params.json   # per-category lead time / service level
├── .github/workflows/
│   └── deploy.yml        # Next.js → GitHub Pages on push to main
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## Caveats

- M5 doesn't include real inventory records — starting stock is seeded synthetically from historical sales patterns.
- WRMSSE here uses a simplified global scale rather than the full M5 hierarchy × dollar-volume weighting, so direct comparison to Kaggle leaderboard scores is approximate.
- Prophet training is ~1 min per SKU; the 2,000-SKU sample was chosen to keep total training time under an hour.
