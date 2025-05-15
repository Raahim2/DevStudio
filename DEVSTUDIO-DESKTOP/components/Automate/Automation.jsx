'use client';

import React, { useState, useCallback } from 'react';
import { FiZap, FiLoader, FiClipboard } from 'react-icons/fi';

const AutomationTab = () => {
    // Essential state
    const [taskDescription, setTaskDescription] = useState('');
    const [template, setTemplate] = useState('React/Node.js');
    const [automationDuration, setAutomationDuration] = useState(5);
    const [projectPlan, setProjectPlan] = useState(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    // Simplified plan generation
    const handleGeneratePlan = useCallback(async () => {
        setIsGeneratingPlan(true);
        try {
            // Placeholder for actual API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            setProjectPlan({
                "Project Overview": {
                    "Project Name": "Sample Project",
                    "Description": taskDescription,
                    "Technology": template,
                    "Duration": automationDuration
                },
                "message": "This is a sample plan. API integration pending."
            });
        } finally {
            setIsGeneratingPlan(false);
        }
    }, [taskDescription, template, automationDuration]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold flex items-center">
                    <FiZap className="mr-2 text-purple-500" /> Project Automation
                </h2>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Project Description
                    </label>
                    <textarea
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        className="w-full p-2 border rounded-md"
                        rows={4}
                        placeholder="Describe your project..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Technology Stack
                        </label>
                        <input
                            type="text"
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            className="w-full p-2 border rounded-md"
                            placeholder="e.g., React/Node.js"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Duration (Days)
                        </label>
                        <input
                            type="number"
                            value={automationDuration}
                            onChange={(e) => setAutomationDuration(e.target.value)}
                            className="w-full p-2 border rounded-md"
                            min="1"
                            max="30"
                        />
                    </div>
                </div>

                <button
                    onClick={handleGeneratePlan}
                    disabled={isGeneratingPlan}
                    className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
                >
                    {isGeneratingPlan ? (
                        <>
                            <FiLoader className="animate-spin mr-2" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <FiClipboard className="mr-2" />
                            Generate Plan
                        </>
                    )}
                </button>
            </div>

            {/* Plan Display */}
            <div className="flex-1 overflow-auto p-4">
                {projectPlan && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Project Plan</h3>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                            <h4 className="font-medium">{projectPlan["Project Overview"]["Project Name"]}</h4>
                            <p className="text-sm mt-2">{projectPlan["Project Overview"]["Description"]}</p>
                            <div className="mt-4 text-sm">
                                <p>Technology: {projectPlan["Project Overview"]["Technology"]}</p>
                                <p>Duration: {projectPlan["Project Overview"]["Duration"]} days</p>
                            </div>
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{projectPlan["message"]}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutomationTab;
