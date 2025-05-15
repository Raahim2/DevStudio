'use client';

import React from 'react';
import { FiZap } from 'react-icons/fi';

const AutomationTab = () => {
    return (
        <div className="flex flex-col h-full bg-white [.dark_&]:bg-neutral-900">
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 [.dark_&]:border-neutral-700">
                <h2 className="text-lg font-semibold flex items-center">
                    <FiZap className="mr-2 text-purple-500" /> <p className='[.dark_&]:text-white'>Project Automation</p>
                </h2>
            </div>

            {/* Coming Soon Content */}
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2 [.dark_&]:text-white">Coming Soon</h3>
                    <p className="text-neutral-600 [.dark_&]:text-neutral-400">
                        Project automation features are currently under development.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AutomationTab;
