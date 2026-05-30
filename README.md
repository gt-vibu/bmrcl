# 🚇 BMRCL Metro Route Planner

A full-stack, production-ready web application for planning routes on the **Bengaluru Metro Rail Corporation Limited (BMRCL)** network. Enter any two stations and instantly get the optimal route, interchange guidance, estimated travel time, and fare — powered by graph-based pathfinding algorithms and a live MongoDB Atlas backend.

🔗 **Live Demo:** [bmrcl.onrender.com](https://bmrcl.onrender.com)

---

## ✨ Features

- 🗺️ **Shortest Route Planning** — BFS/DFS graph traversal finds the optimal path between any two stations
- 🔁 **Interchange Detection** — Automatically identifies where to change metro lines
- 💰 **Fare Estimation** — Calculates fare based on distance and zone rules
- ⏱️ **Travel Time Estimation** — Provides estimated journey duration
- 📡 **Live Metro Data** — All station, line, and timing data served from MongoDB Atlas
- 🩺 **Health Check API** — `/api/health/db` endpoint to verify database connectivity
- 📱 **Responsive UI** — Fully responsive React frontend built with Tailwind CSS
- ⚡ **Single-Server Architecture** — Express serves both the API and the React SPA in production

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express.js, TypeScript |
| Database | MongoDB Atlas |
| Animation | Motion (Framer Motion) |
| Icons | Lucide React |
| Dev Runtime | tsx |
| Deployment | Render (backend) · Vercel (frontend pipeline) |

---

## 📁 Project Structure

```
bmrcl/
├── src/                  # React frontend source
│   └── ...               # Components, pages, hooks
├── server/
│   ├── mongo.ts          # MongoDB connection handler
│   └── metroSeed.ts      # Metro data seed (lines, stations, fares, timings)
├── server.ts             # Express server — API routes + Vite middleware + static serving
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── metadata.json         # App metadata
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- A **MongoDB Atlas** account and cluster ([free tier works](https://www.mongodb.com/atlas))

### 1. Clone the Repository

```bash
git clone https://github.com/gt-vibu/bmrcl.git
cd bmrcl
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
MONGODB_URI="mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME="csi_main"
```

> ⚠️ Never commit your real Atlas URI. It's already listed in `.gitignore`.

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

On first startup, the server **automatically seeds MongoDB** with all metro lines, station data, interchange rules, fare tables, and timings — no manual setup needed.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/metro-data` | Returns the full metro dataset (lines, stations, fares) |
| `GET` | `/api/timings` | Returns metro operating hours and frequency data |
| `GET` | `/api/health/db` | MongoDB connection health check |

### Health Check Response

```json
{ "ok": true, "database": "csi_main" }
```

---

## ☁️ Deployment

### Render (Backend + Full App)

1. Connect your GitHub repo to [Render](https://render.com)
2. Set **Build Command:** `npm run build`
3. Set **Start Command:** `npm start`
4. Add environment variables in the Render dashboard:
   ```
   MONGODB_URI=your_atlas_connection_string
   MONGODB_DB_NAME=csi_main
   NODE_ENV=production
   ```

In production mode, Express serves the compiled React SPA (`dist/`) as static files and handles all `*` routes — no separate frontend hosting needed.

### Vercel (Frontend Only)

If deploying the frontend separately via Vercel, point it to the `dist` output from `npm run build`. Set the backend URL as an environment variable in your Vite config.

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (Express + Vite HMR) |
| `npm start` | Start production server |
| `npm run build` | Build React frontend to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | TypeScript type-check (no emit) |
| `npm run clean` | Remove the `dist/` directory |

---

## 🗄️ Database Schema

The app uses a single MongoDB document (`_id: "metro-data"`) in the `appData` collection, seeded automatically on first boot. It contains:

- **Lines** — Purple Line, Green Line, Yellow Line, Pink Line, etc.
- **Stations** — All BMRCL stations with coordinates and line associations
- **Interchanges** — Cross-line transfer station mappings
- **Fare Rules** — Zone and distance-based fare calculation tables
- **Timings** — First/last train times and headway frequencies

---

## 🧠 Algorithm

The route planner uses a **graph-based shortest-path algorithm** where:

- Each **station** is a node
- Each **direct connection** between adjacent stations is a weighted edge
- **Interchanges** are modelled as zero-cost or transfer-cost edges between line graphs
- BFS/DFS traversal finds the path minimising stops (or weighted cost)

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 👤 Author

**Vibu Darshan S**

- GitHub: [@gt-vibu](https://github.com/gt-vibu)
- LinkedIn: [vibu-darshan-138272307](https://www.linkedin.com/in/vibu-darshan-138272307/)
- Email: vibudarshan1717@gmail.com

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

> Built with ❤️ for Bengaluru commuters.
