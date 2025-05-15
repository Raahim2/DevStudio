'use client';

import { FiGithub, FiLogIn } from 'react-icons/fi';

const GitHubLogin = ({ onLoginAttempt }) => { // Prop is now named onLoginAttempt
 
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col items-center justify-center p-6 text-slate-800">
            <div className="w-full max-w-md bg-white shadow-xl rounded-xl p-8 md:p-12 border border-slate-200">
                <div className="flex flex-col items-center mb-8">
                    <FiGithub className="w-16 h-16 text-blue-600 mb-4" />
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Connect to GitHub</h1>
                    <p className="text-slate-600 mt-2 text-center text-sm">
                        Sign in with your GitHub account to access your repositories and streamline your workflow.
                    </p>
                </div>

                

                    <button
                        onClick={onLoginAttempt}
                        disabled={isLoading}
                        className={`w-full flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-medium rounded-lg shadow-sm text-white
                                    bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                                    transition-colors duration-150 ease-in-out
                                    disabled:opacity-70 disabled:cursor-not-allowed group`}
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Connecting...
                            </>
                        ) : (
                            <>
                                <FiLogIn className="w-5 h-5 mr-3 transform transition-transform duration-200 group-hover:translate-x-1" />
                                Sign in with GitHub
                            </>
                        )}
                    </button>


                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-500">
                        By signing in, you agree to our <a href="#" className="font-medium text-blue-600 hover:text-blue-500">Terms of Service</a> and <a href="#" className="font-medium text-blue-600 hover:text-blue-500">Privacy Policy</a>.
                    </p>
                </div>
            </div>

            <footer className="mt-12 text-center">
                <p className="text-sm text-slate-600">
                    Powered by <span className="font-semibold text-slate-700">DevStudio</span>
                </p>
            </footer>
        </div>
    );
};

export default GitHubLogin;