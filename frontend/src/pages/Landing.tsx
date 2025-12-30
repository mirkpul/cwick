import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing(): React.JSX.Element {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-primary-600">RAG Knowledge Base</span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <Link
                  to={user.role === 'super_admin' ? '/admin' : '/dashboard'}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-primary-600"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6">
            Build Your AI-Powered Knowledge Base
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Create intelligent AI assistants powered by your own data using advanced RAG technology.
            Upload documents, connect emails, and let AI answer questions with contextual accuracy.
          </p>
          <Link
            to="/register"
            className="inline-block bg-primary-600 text-white text-lg px-8 py-3 rounded-lg hover:bg-primary-700 transition"
          >
            Start Free Trial
          </Link>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Multi-Source Knowledge</h3>
            <p className="text-gray-600">
              Upload documents, connect emails, scrape websites, and manually add FAQ entries to build your knowledge base.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Advanced RAG Search</h3>
            <p className="text-gray-600">
              Hybrid search combining vector similarity and keyword matching with intelligent reranking for optimal results.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Multi-Provider AI</h3>
            <p className="text-gray-600">
              Choose from OpenAI (GPT-4), Anthropic (Claude), or Google (Gemini) to power your AI assistant.
            </p>
          </div>
        </div>

        <div className="mt-20 bg-white rounded-lg shadow-lg p-10">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="font-bold mb-2">Sign Up</h4>
              <p className="text-gray-600 text-sm">Create your account in seconds</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="font-bold mb-2">Build Knowledge Base</h4>
              <p className="text-gray-600 text-sm">Upload documents, connect data sources, and configure your AI</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="font-bold mb-2">Chat & Test</h4>
              <p className="text-gray-600 text-sm">Test your AI assistant with semantic search and conversations</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h4 className="font-bold mb-2">Integrate</h4>
              <p className="text-gray-600 text-sm">Embed on your website or use via API</p>
            </div>
          </div>
        </div>

        <div className="mt-20 bg-primary-600 text-white rounded-lg shadow-lg p-10 text-center">
          <h2 className="text-3xl font-bold mb-4">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-6 mt-8 text-left max-w-4xl mx-auto">
            <div className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-bold mb-1">Document Upload (PDF, DOCX, TXT)</h4>
                <p className="text-primary-100 text-sm">Automatic text extraction and vectorization</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-bold mb-1">Email Integration (Gmail, Outlook, IMAP)</h4>
                <p className="text-primary-100 text-sm">Search your email history with AI</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-bold mb-1">Web Scraping</h4>
                <p className="text-primary-100 text-sm">Automatically scrape and index website content</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-bold mb-1">Semantic Search & Benchmarking</h4>
                <p className="text-primary-100 text-sm">Test and optimize your RAG configuration</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">© 2025 RAG Knowledge Base Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
