# FluxCode.io 🚀

Une webapp pédagogique d'analyse de code pour débutants et intermédiaires.

## 🎯 Fonctionnalités

- **Analyse automatique** de projets ZIP uploadés
- **Graphe visuel interactif** des relations entre fichiers
- **Détection d'erreurs** et suggestions d'amélioration
- **Analyse IA locale** sans clés API requises
- **Mode apprentissage guidé** et mode libre
- **Dark/Light mode** avec interface moderne
- **Export PDF/Markdown** des rapports d'analyse

## 🧱 Architecture

```
fluxcode-io/
├── frontend/          # React + Vite + TailwindCSS
├── backend/           # Express.js + Multer
├── shared/            # Types partagés
├── docs/              # Documentation
└── assets/            # Ressources visuelles
```

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Démarrage rapide

1. **Backend**
```bash
cd backend
npm install
npm run dev
```

2. **Frontend**
```bash
cd frontend
npm install
npm run dev
```

3. **Accès**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 📖 Utilisation

1. Uploadez un projet ZIP
2. Visualisez le graphe des relations
3. Consultez l'analyse IA
4. Exportez le rapport

## 🛠️ Développement

### Scripts disponibles
- `npm run dev` - Démarrage en mode développement
- `npm run build` - Build de production
- `npm run test` - Tests unitaires
- `npm run lint` - Vérification du code

### Structure des données
```typescript
interface ProjectAnalysis {
  files: FileNode[];
  relationships: Relationship[];
  errors: CodeError[];
  suggestions: Suggestion[];
  metrics: QualityMetrics;
}
```

## 🚀 Déploiement

### Vercel (Recommandé)
```bash
npm run build
vercel --prod
```

### Docker
```bash
docker-compose up -d
```

## 📝 Licence

MIT License - Voir [LICENSE](LICENSE) pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md).

---

Développé avec ❤️ pour la communauté des développeurs
