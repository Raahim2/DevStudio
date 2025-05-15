import React from 'react';
import { FiRefreshCw } from 'react-icons/fi';

const LoadingIndicator = ({ message = "Loading..." }) => {
    return (
        <div className="p-4 text-gray-600 flex-1 flex items-center justify-center bg-gray-50 [.dark_&]:bg-neutral-800">
            <FiRefreshCw className="animate-spin mr-2 [.dark_&]:text-white" size={24} /> {message}
        </div>
    );
};

export default LoadingIndicator;