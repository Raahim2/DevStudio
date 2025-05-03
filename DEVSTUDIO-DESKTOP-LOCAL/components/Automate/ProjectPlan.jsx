// src/components/ProjectPlanDisplay.jsx
import React from 'react';
import { FiBox, FiCalendar, FiFile, FiEdit2, FiTrash2, FiInfo } from 'react-icons/fi';

const ProjectPlanDisplay = ({ plan }) => {

    console.log("Project Plan:", plan); // Debugging line to check the plan structure
    if (!plan || !plan["Project Overview"] || !plan["Daily Breakdown"]) {
        return (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <FiInfo className="inline-block mr-2" /> No project plan available.
            </div>
        );
    }

    const { "Project Overview": overview, "Default File Structure": fileStructure, "Daily Breakdown": dailyTasks } = plan;

    return (
        <div className="p-4 space-y-6 text-sm">
            {/* Project Overview Section */}
            <section className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-800 dark:text-gray-200">
                    <FiBox className="mr-2 text-blue-500" /> Project Overview
                </h3>
                <div className="space-y-2">
                    <p><strong>Name:</strong> {overview["Project Name"]}</p>
                    <p><strong>Description:</strong> {overview["Project Description"]}</p>
                    <p><strong>Template:</strong> {overview["Template"]}</p>
                    <p><strong>Duration:</strong> {overview["Duration"]} Days</p>
                     {fileStructure && (
                        <div>
                            <strong>Default File Structure:</strong>
                            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto">
                                {fileStructure}
                            </pre>
                        </div>
                     )}
                </div>
            </section>

            {/* Daily Breakdown Section */}
            <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-800 dark:text-gray-200">
                    <FiCalendar className="mr-2 text-green-500" /> Daily Breakdown ({dailyTasks.length} Days)
                </h3>
                <div className="space-y-4">
                    {dailyTasks.map((dayPlan) => (
                        <div key={dayPlan.Day} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div className="bg-gray-100 dark:bg-gray-700/60 p-3 font-medium">
                                Day {dayPlan.Day}: {dayPlan["Task Title"]}
                            </div>
                            <div className="p-3 space-y-2 bg-white dark:bg-gray-800">
                                {dayPlan["Files to Create"]?.length > 0 && (
                                    <div className="flex items-start text-xs">
                                        <FiFile className="mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                                        <div><strong>Create:</strong> {dayPlan["Files to Create"].join(', ')}</div>
                                    </div>
                                )}
                                {dayPlan["Files to Modify"]?.length > 0 && (
                                    <div className="flex items-start text-xs">
                                        <FiEdit2 className="mr-2 mt-0.5 text-yellow-500 flex-shrink-0" />
                                        <div><strong>Modify:</strong> {dayPlan["Files to Modify"].join(', ')}</div>
                                    </div>
                                )}
                                {dayPlan["Files to Delete"]?.length > 0 && (
                                     <div className="flex items-start text-xs">
                                        <FiTrash2 className="mr-2 mt-0.5 text-red-500 flex-shrink-0" />
                                        <div><strong>Delete:</strong> {dayPlan["Files to Delete"].join(', ')}</div>
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium mt-1">Details:</p>
                                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {dayPlan["Task Details"]}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default ProjectPlanDisplay;