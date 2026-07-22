# Codebase Whisperer 🧑‍💻✨

**Codebase Whisperer** is a powerful AI-driven SaaS platform that allows developers to "chat" with any GitHub repository. By leveraging advanced Retrieval-Augmented Generation (RAG) and Tree-sitter Abstract Syntax Tree (AST) parsing, the platform understands repository architecture, code logic, and dependencies, providing deep, context-aware answers to your programming questions.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_Vector_Search-green)
![Tailwind](https://img.shields.io/badge/TailwindCSS-v4-38B2AC)

---

## 🌟 Key Achievements & Features

### 1. Intelligent Repository Ingestion
* **GitHub API Integration**: Fetches repository contents, including branches and file trees, while adhering to rate limits and ignoring irrelevant files (e.g., binaries, lockfiles, node_modules).
* **AST-based Code Chunking**: Uses `web-tree-sitter` to parse code logically into functions, classes, and methods, capturing critical metadata (line numbers, scopes, dependencies).
* **Server-Sent Events (SSE)**: Streams real-time ingestion progress to the frontend, providing an enterprise-grade user experience during large repository processing.

### 2. Advanced AI & RAG Pipeline
* **Dual-Provider LLM Fallback**: Employs a robust `AIRouter` that defaults to Hugging Face (`Qwen/Qwen2.5-Coder-7B-Instruct`) for fast embeddings and generation, with automatic, graceful failover to Google Gemini (`gemini-2.5-flash`) for unmatched reliability.
* **Vector Search**: Computes high-dimensional embeddings and stores them in MongoDB. Queries perform a similarity search utilizing MongoDB Atlas `$vectorSearch` to strictly retrieve the most relevant codebase context for the LLM.

### 3. Production-Ready User & Chat Management
* **Authentication**: Fully secured by Clerk (`@clerk/nextjs`), separating user instances and protecting API routes.
* **Persistent History**: Chat threads are persisted in MongoDB using an embedded document model.
* **Vercel AI SDK Integration**: Real-time markdown streaming via `@ai-sdk/react`. Chat sessions seamlessly restore exact message context and metadata across navigations without UI blocking.

### 4. Stunning Premium UI
* Built with modern **Tailwind CSS v4** and **Framer Motion** for smooth, micro-interaction animations.
* Glassmorphism effects, dynamic dot-grid backgrounds, and responsive sidebars designed to feel like a state-of-the-art developer tool.

---

## 🏗 System Architecture

The application is built entirely on the modern web stack, deployed on Vercel Serverless environments:

* **Framework**: Next.js 16 (App Router) + React 19
* **Database**: MongoDB (Atlas) for both application data (Chats/Users) and high-dimensional Vector storage.
* **Authentication**: Clerk Identity Management
* **AI Tooling**: Vercel AI SDK, Hugging Face API, Google Generative AI API
* **Parsing**: Web Tree-sitter (WASM) for universal syntax parsing.

---

## 🚀 Getting Started

### Prerequisites
You will need API keys for the following services:
- **MongoDB Atlas** (with Vector Search index configured)
- **Clerk** (Publishable and Secret keys)
- **Hugging Face**
- **Google Gemini**
- **GitHub** (Personal Access Token for bypassing rate limits)

### Environment Setup

Create a `.env.local` file in the root of the project with the following:

```env
# Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?appName=Cluster0

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# AI Providers
HF_TOKEN=hf_...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# External Services
GITHUB_PAT=ghp_...
```

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

---

## 💡 How It Works

1. **Importing**: A user inputs a repository URL (e.g., `facebook/react`). The backend streams the tree retrieval and chunking phase over SSE.
2. **Chunking**: Source files are logically broken down by an AST tree-sitter. Embeddings are generated for each logical chunk and written to MongoDB.
3. **Chatting**: When a user asks a question, the query is converted to an embedding, matched against the repository's vector space, and injected into the LLM system prompt.
4. **Streaming**: The Vercel AI SDK streams the generated answer (with syntax-highlighted markdown) back to the user's browser, finally persisting the thread atomically in the database upon stream completion.

---
*Built with passion and modern web technologies.*
