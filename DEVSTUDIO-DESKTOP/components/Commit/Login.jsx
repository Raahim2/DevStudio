'use client';

import { FiGithub, FiLogIn } from 'react-icons/fi';

const GitHubLogin = ({ onLoginAttempt }) => { // Prop is now named onLoginAttempt
 
    
    return (
        <>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 [.dark_&]:from-neutral-900 [.dark_&]:to-neutral-800 flex flex-col items-center justify-center p-6 text-slate-800 [.dark_&]:text-neutral-200">
            <div className="w-full max-w-md bg-white [.dark_&]:bg-neutral-800 shadow-xl rounded-xl p-8 md:p-12 border border-slate-200 [.dark_&]:border-neutral-700">
                <div className="flex flex-col items-center mb-8">
                    <FiGithub className="w-16 h-16 text-blue-600 [.dark_&]:text-blue-500 mb-4" />
                    <h1 className="text-3xl font-bold text-slate-900 [.dark_&]:text-neutral-100 tracking-tight">Connect to GitHub</h1>
                    <p className="text-slate-600 [.dark_&]:text-neutral-400 mt-2 text-center text-sm">
                        Sign in with your GitHub account to access your repositories and streamline your workflow.
                    </p>
                </div>

                <button
                    onClick={onLoginAttempt}
                    className={`w-full flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-medium rounded-lg shadow-sm text-white
                                bg-blue-600 hover:bg-blue-700 [.dark_&]:bg-blue-600 [.dark_&]:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 [.dark_&]:focus:ring-offset-neutral-800
                                transition-colors duration-150 ease-in-out
                                disabled:opacity-70 disabled:cursor-not-allowed group`}
                >

                        <>
                            <FiLogIn className="w-5 h-5 mr-3 transform transition-transform duration-200 group-hover:translate-x-1" />
                            Sign in with GitHub
                        </>
                </button>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-500 [.dark_&]:text-neutral-400">
                        By signing in, you agree to our <a href="#" className="font-medium text-blue-600 hover:text-blue-500 [.dark_&]:text-blue-400 [.dark_&]:hover:text-blue-300">Terms of Service</a> and <a href="#" className="font-medium text-blue-600 hover:text-blue-500 [.dark_&]:text-blue-400 [.dark_&]:hover:text-blue-300">Privacy Policy</a>.
                    </p>
                </div>
            </div>

            <footer className="mt-12 text-center">
                <p className="text-sm text-slate-600 [.dark_&]:text-neutral-400">
                    Powered by <span className="font-semibold text-slate-700 [.dark_&]:text-neutral-300">DevStudio</span>
                </p>
            </footer>
        </div>
        </>
        
    );
};

export default GitHubLogin;