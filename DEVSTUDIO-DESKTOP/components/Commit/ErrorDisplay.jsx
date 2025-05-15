import React from 'react';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

const ErrorDisplay = ({
    error,
    onRetry,
    onSetup,
    isLoading,
    showSetupOption = false
}) => {
    if (!error) return null;

    return (
        <div className="p-4 text-red-600 bg-red-50 border border-red-200 rounded m-4 flex-1 overflow-auto">
            <h3 className="font-bold flex items-center mb-2"><FiAlertCircle className="inline mr-2" size={20} /> Error</h3>
            <p className="whitespace-pre-wrap break-words text-sm mb-3">{error}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm mr-2"
                    disabled={isLoading}
                >
                    {isLoading ? <FiRefreshCw className="animate-spin inline mr-1"/> : null}
                    Retry Status Fetch
                </button>
            )}
             {showSetupOption && onSetup && (
                 <button
                    onClick={onSetup}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    disabled={isLoading}
                >
                    Setup Repository
                </button>
            )}
        </div>
    );
};

export default ErrorDisplay;