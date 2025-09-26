# Mental Models Observatory - Complete Setup Guide

## 🎉 **CONGRATULATIONS!** Your development environment is ready!

Your Mental Models Observatory is now fully configured with your 40-domain Readwise framework and ready for development and deployment.

## 📊 **What's Included**

✅ **Next.js 14** project with App Router and TypeScript  
✅ **Tailwind CSS v3** with custom design system  
✅ **40 domains with 119 mental models** parsed from your Readwise framework  
✅ **VS Code workspace** with debugging, extensions, and settings  
✅ **GitHub workflows** for CI/CD and deployment  
✅ **Complete type safety** with TypeScript strict mode  
✅ **Code quality** with ESLint, Prettier, and pre-commit hooks  
✅ **Production-ready** configuration for Vercel deployment  

## 🚀 **Next Steps**

### 1. **Get Your Readwise API Token**

1. Go to [Readwise Access Token](https://readwise.io/access_token)
2. Copy your access token
3. Create `.env.local` file:
   ```bash
   cp .env.local.example .env.local
   ```
4. Add your token:
   ```env
   READWISE_API_TOKEN=your_actual_token_here
   ```

### 2. **Install Recommended VS Code Extensions**

Open VS Code and it will automatically prompt you to install the recommended extensions, or manually install:

- Prettier - Code formatter
- ESLint
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features
- Error Lens
- Material Icon Theme

### 3. **Start Development**

```bash
# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

### 4. **Available Commands**

```bash
# Development
npm run dev              # Start development server
npm run dev:debug        # Start with debugging enabled
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run type-check       # Check TypeScript types
npm run format           # Format code with Prettier
npm run test:all         # Run all tests (type, lint, format)

# Data Management
npm run parse-readwise   # Re-parse Readwise framework
npm run clean            # Clean build artifacts
npm run setup            # Run setup script

# Deployment
npm run deploy:vercel    # Deploy to Vercel (production)
npm run deploy:preview   # Deploy preview
```

## 🔧 **Development Workflow**

### **VS Code Features**
- **Debugging**: Press F5 to start debugging Next.js
- **Tasks**: Ctrl+Shift+P → "Tasks: Run Task"
- **IntelliSense**: Full TypeScript and Tailwind support
- **Auto-formatting**: On save with Prettier
- **Error highlighting**: Real-time with Error Lens

### **Git Workflow**
```bash
# Feature development
git checkout -b feature/your-feature
git add .
git commit -m "feat: description"
git push origin feature/your-feature

# Create PR on GitHub
# Automatic CI/CD will run tests and deploy preview
```

## 📂 **Project Structure**

```
mental-models-observatory/
├── app/                 # Next.js 14 App Router
│   ├── domains/        # Domain pages (/domains/[slug])
│   ├── models/         # Model pages (/models/[slug])
│   ├── about/          # About page
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Homepage
│   └── globals.css     # Global styles
├── components/         # React components (ready for expansion)
├── lib/
│   ├── data.ts         # Main data functions
│   ├── readwise-data.ts # Generated from your framework
│   ├── readwise.ts     # Readwise API integration
│   └── utils.ts        # Utility functions
├── types/              # TypeScript type definitions
├── scripts/
│   ├── parse-readwise-framework.js # Data parser
│   └── setup.sh        # Setup script
└── .vscode/           # VS Code configuration
```

## 🎨 **Customization**

### **Branding**
Update your branding in:
- `app/layout.tsx` - Site name and navigation
- `.env.local.example` - Contact info and URLs
- `package.json` - Project name and description

### **Colors & Design**
- `tailwind.config.ts` - Custom color palette
- `app/globals.css` - Global styles and animations

### **Content**
- `lib/readwise-data.ts` - Auto-generated from your framework
- Run `npm run parse-readwise` after updating `Readwise Frameworks.md`

## 🚀 **Deployment**

### **Vercel (Recommended)**
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `npm run deploy:vercel`
4. Add environment variables in Vercel dashboard

### **Environment Variables for Production**
```env
READWISE_API_TOKEN=your_readwise_token
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SITE_NAME="Mental Models Observatory"
NEXT_PUBLIC_CONTACT_EMAIL=your@email.com
NEXT_PUBLIC_GITHUB_URL=https://github.com/yourusername/repo
```

## 📈 **GitHub Actions**

Automatic workflows will:
- ✅ Run type checking, linting, and formatting checks
- ✅ Build the application
- ✅ Deploy preview environments for PRs
- ✅ Deploy to production on main branch

## 🆘 **Troubleshooting**

### **Common Issues**

1. **Tailwind classes not working**
   ```bash
   npm run clean
   npm run dev
   ```

2. **Type errors**
   ```bash
   npm run type-check
   ```

3. **Readwise data not updating**
   ```bash
   npm run parse-readwise
   ```

4. **Port already in use**
   ```bash
   npx kill-port 3000
   npm run dev
   ```

### **Performance Optimization**
- Images: Use Next.js `Image` component
- Fonts: Already optimized with `next/font`
- Bundle: Run `npm run analyze` to analyze bundle size

## 🎯 **What's Next?**

1. **Connect Readwise API** - Add your token to `.env.local`
2. **Customize content** - Update domain/model descriptions
3. **Add search** - Implement search functionality
4. **Deploy** - Push to production with Vercel
5. **Share** - Show the world your mental models collection!

## 🤝 **Contributing**

Your project is set up for collaboration:
- Pull request templates
- Issue templates (bug reports, feature requests)
- Automated testing and deployment
- Code quality checks

## 📞 **Support**

If you need help:
1. Check the `README.md` for detailed documentation
2. Review the TypeScript types in `types/index.ts`
3. Look at example components in `app/`
4. Check the console for helpful error messages

---

**🧠 Happy Building! Your Mental Models Observatory is ready to expand minds!**
