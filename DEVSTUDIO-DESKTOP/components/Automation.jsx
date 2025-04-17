// src/components/AutomationTab.jsx
'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    FiCheckCircle, FiXCircle, FiLoader, FiTerminal, FiTrash2, FiAlertCircle,
    FiZap, FiGithub, FiSave, FiClock, FiClipboard // Added FiClipboard for Plan Gen
} from 'react-icons/fi';

// --- Import Hooks and Utils ---
import { useGitHubApi } from '../hooks/useGitHubApi'; // Adjust path
import { callGeminiForPlan } from '../hooks/geminiUtils';
import ProjectPlanDisplay from './ProjectPlan'

// --- Workflow Content Generation (Keep or adapt as needed) ---
const WORKFLOW_FILE_PATH = '.github/workflows/custom-automate.yml';
const getWorkflowContent = (repoFullName, taskName, frequencyDays = 1) => { // Default freq to 1 if not specified
    const planTaskName = taskName || 'Automated Task'; // Fallback if no task name
    return `
name: Custom Automation for ${planTaskName}

on:
  schedule:
    - cron: '0 0 * * *' # Runs daily
  workflow_dispatch:

jobs:
  trigger_custom_api:
    runs-on: ubuntu-latest
    steps:
      - name: Send POST Request for '${planTaskName}'
        env:
           REPO_FULL_NAME: \${{ secrets.REPO_FULL_NAME || '${repoFullName}' }}
           TASK_NAME: \${{ secrets.TASK_NAME || '${planTaskName}' }}
           FREQUENCY_DAYS: \${{ secrets.FREQUENCY_DAYS || '${frequencyDays}' }} # Still pass frequency if needed by API
        run: |
          echo "Triggering automation for task: $TASK_NAME in repo: $REPO_FULL_NAME"
          curl -X POST -H "Content-Type: application/json" \\
               -d '{ "repo": "'"$REPO_FULL_NAME"'", "task": "'"$TASK_NAME"'", "frequency": '"$FREQUENCY_DAYS"', "event": "daily_cron" }' \\
               https://api.vercel.app/automate || echo "Curl command failed"
`;
};

// --- Main Automation Tab Component ---

const AutomationTab = ({ repoFullName, accessToken }) => {
    // --- Form State ---
    const [taskDescription, setTaskDescription] = useState('');
    const [template, setTemplate] = useState('React/Node.js'); // Default template example
    const [automationDuration, setAutomationDuration] = useState(5); // Default duration in days
    const [formErrors, setFormErrors] = useState({});

    // --- Gemini Plan State ---
    const [projectPlan, setProjectPlan] = useState(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [generationError, setGenerationError] = useState(null);

    // --- GitHub API Hook ---
    const {
        isOperating: isGitHubOperating,
        operationError: gitHubError,
        createFile,
        clearOperationError: clearGitHubError,
    } = useGitHubApi(accessToken, repoFullName);

    // --- Workflow State ---
    const [workflowExists, setWorkflowExists] = useState(null); // null, 'checking', true, false, 'error'
    const [workflowCheckError, setWorkflowCheckError] = useState(null);
    const [workflowCreateError, setWorkflowCreateError] = useState(null);

    // --- Log State (Simplified for status messages) ---
    const [logs, setLogs] = useState([]);
    const logContainerRef = useRef(null);
    const addLog = useCallback((message, type = 'info') => {
        setLogs(prev => [...prev.slice(-100), { message: `[${new Date().toLocaleTimeString()}] ${message}`, type }]); // Keep last 100 logs
    }, []);
    useEffect(() => { /* ... scroll logic ... */ }, [logs]);

    // --- Form Validation ---
    const validateForm = useCallback(() => {
        const errors = {};
        if (!taskDescription.trim()) errors.taskDescription = 'Task description cannot be empty.';
        if (!template.trim()) errors.template = 'Template cannot be empty.';
        const duration = Number(automationDuration);
        if (isNaN(duration) || duration < 2 || duration > 30) errors.automationDuration = 'Duration must be between 2 and 30 days.';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }, [taskDescription, template, automationDuration]);

    // --- Check Workflow Existence ---
    const checkWorkflowExists = useCallback(async () => {
        // ... (Keep the existing checkWorkflowExists logic using fetch or hook method) ...
        // ... Make sure it calls addLog for feedback ...
         if (!repoFullName || !accessToken) { setWorkflowExists(null); return; }
         setWorkflowExists('checking');
         setWorkflowCheckError(null);
         setWorkflowCreateError(null);
         clearGitHubError();
         addLog('Checking for existing automation workflow...');
         try {
             const apiUrl = `https://api.github.com/repos/${repoFullName}/contents/${WORKFLOW_FILE_PATH}`;
             const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/vnd.github.v3+json' }});
             if (response.ok) { setWorkflowExists(true); addLog('Existing automation workflow found.', 'success'); }
             else if (response.status === 404) { setWorkflowExists(false); addLog('No existing workflow found.'); }
             else { const d = await response.json(); setWorkflowCheckError(`Check failed (${response.status}): ${d.message || 'Unknown'}`); setWorkflowExists('error'); addLog(`Error checking workflow: ${d.message || response.status}`, 'error'); }
         } catch (e) { setWorkflowCheckError(`Network error: ${e.message}`); setWorkflowExists('error'); addLog(`Network error checking workflow: ${e.message}`, 'error'); }
    }, [repoFullName, accessToken, clearGitHubError, addLog]);

    // --- Effect to check workflow & reset form on repo change ---
    useEffect(() => {
        checkWorkflowExists();
        setLogs([]);
        setProjectPlan(null); // Clear plan
        setGenerationError(null);
        setTaskDescription(''); // Reset form
        setTemplate('React/Node.js');
        setAutomationDuration(5);
        setFormErrors({});
    }, [checkWorkflowExists]); // Re-run check when function identity changes

    // --- Handle Plan Generation ---
    // const handleGeneratePlan = useCallback(async () => {
    //     if (!validateForm()) {
    //         addLog('Please fix form errors before generating the plan.', 'error');
    //         return;
    //     }
    //     setGenerationError(null);
    //     setProjectPlan(null); // Clear previous plan
    //     setIsGeneratingPlan(true);
    //     addLog('Generating project plan with Gemini...');

    //     // TODO: Define fileStructure based on template - This might need more logic or be part of the prompt

    //     const prompt = `
    //     Generate ONLY the JSON response matching the specified structure. Do NOT include any introductory text, explanations, apologies, or markdown formatting like \`\`\`json or \`\`\`. The output MUST start directly with '{' and end directly with '}'.

    //     Project Details:

    //     ProjectDesc: ${taskDescription}
    //     Template: ${template}
    //     Duration: ${automationDuration}

    //     JSON Structure Example (Follow this structure EXACTLY):

    //     Instructions for YOU (Strictly Follow):

    //     1. Use the provided ProjectDesc, Template, and Duration.
    //     2. Auto-generate the 'Default File Structure' based on the Template.
    //     3. Create logical, incremental daily coding tasks for the specified Duration.
    //     4. Clearly list file operations (Create, Modify, Delete) for each day. Use empty arrays [] if none.
    //     5. Ensure tasks build towards project completion by the final day.
    //     6. Focus ONLY on coding tasks.
    //     7. Output ONLY the raw JSON object, starting with '{' and ending with '}'. Absolutely NO extra text or markdown.
    //     8. **VERY IMPORTANT:** Ensure all strings within the generated JSON are correctly formatted and escaped according to JSON standards. Specifically, any double quotes (") or backslashes (\\) inside a string value (like in 'Task Details' code examples) MUST be escaped with a preceding backslash (e.g., \\" and \\\\). Newlines within strings should be represented as \\n.
    //   `;

    //     try {
    //         const plan = await callGeminiForPlan(prompt);
    //         console.log("Generated Plan:", plan.split('\n').slice(1, -1).join('\n')); // Debugging log
    //         setProjectPlan(plan.split('\n').slice(1, -1).join('\n'));
    //         addLog('Project plan generated successfully!', 'success');
    //         setFormErrors({}); // Clear errors on success
    //     } catch (error) {
    //         console.error("Plan generation failed:", error);
    //         const errorMsg = error.message || 'Unknown error during plan generation.';
    //         setGenerationError(errorMsg);
    //         addLog(`Plan generation failed: ${errorMsg}`, 'error');
    //     } finally {
    //         setIsGeneratingPlan(false);
    //     }
    // }, [validateForm, taskDescription, template, automationDuration, addLog]);

    const handleGeneratePlan = useCallback(async () => {
        
        setGenerationError(null);
        setProjectPlan({"messege": "This process in under developtment"}); // Clear previous plan
        setIsGeneratingPlan(true);
        addLog('Generating project plan with Gemini...');
        setIsGeneratingPlan(true);

        // TODO: Define fileStructure based on template - This might need more logic or be part of the prompt

        
    }, [validateForm, taskDescription, template, automationDuration, addLog]);


    // --- Handler to Create Workflow File (Triggered separately AFTER plan generation) ---
    const handleCreateAutomationWorkflow = useCallback(async () => {
        if (!repoFullName || !accessToken || workflowExists !== false || !projectPlan) {
            addLog(`Cannot create workflow: Ensure a plan is generated and workflow doesn't already exist.', 'error`)
            return;
        }

         setWorkflowCreateError(null);
         clearGitHubError();

        // Use info from the generated plan if available
        const taskNameFromPlan = projectPlan?.["Project Overview"]?.["Project Name"] || 'Generated Task';
        // Determine frequency - maybe use duration, or keep it simple (daily trigger, API handles it)
        const frequencyForApi = projectPlan?.["Project Overview"]?.["Duration"] || automationDuration; // Example: pass duration to API

        const content = getWorkflowContent(repoFullName, taskNameFromPlan, frequencyForApi);
        const commitMessage = `ci: Add automation workflow for '${taskNameFromPlan}'`;

        addLog(`Creating workflow file: ${WORKFLOW_FILE_PATH}...`);
        const result = await createFile(WORKFLOW_FILE_PATH, content, commitMessage);

        if (result.success) {
            setWorkflowExists(true);
            addLog('Workflow created successfully!', 'success');
        } else {
            const errorMsg = result.error || 'Failed to create workflow file.';
            setWorkflowCreateError(errorMsg);
            setWorkflowExists(false); // Stay in 'not exists' state
            addLog(`Workflow creation failed: ${errorMsg}`, 'error');
        }
    }, [repoFullName, accessToken, createFile, workflowExists, projectPlan, automationDuration, clearGitHubError, addLog]);


    // --- UI State Logic ---
    // const isFormValid = useMemo(() => Object.keys(formErrors).length === 0 && !!taskDescription.trim() && !!template.trim(), [formErrors, taskDescription, template]);
    const isFormValid = true

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                <h2 className="text-base font-semibold flex items-center">
                    <FiZap className="mr-2 text-purple-500" /> Project Plan Automation
                </h2>
            </div>

             {/* Display Combined Errors (Generation + GitHub) */}
             {(generationError || workflowCheckError || workflowCreateError || gitHubError) && (
                <div className="p-3 border-b border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs flex items-start justify-between flex-shrink-0">
                    <div className="flex items-center">
                        <FiAlertCircle className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span>
                            {generationError || workflowCreateError || gitHubError || workflowCheckError || 'An error occurred.'}
                        </span>
                    </div>
                     <button
                       onClick={() => { setGenerationError(null); setWorkflowCheckError(null); setWorkflowCreateError(null); clearGitHubError(); }}
                       className="ml-2 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400"
                       title="Dismiss error"
                    >
                       <FiXCircle size={14} />
                    </button>
                </div>
             )}

             {/* Configuration Form Area */}
             <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/30">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                     {/* Column 1: Description */}
                     <div className="md:col-span-1">
                         <label htmlFor="taskDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                             Project Description <span className='text-red-500'>*</span>
                         </label>
                         <textarea
                             id="taskDescription"
                             name="taskDescription"
                             rows={4}
                             value={taskDescription}
                             onChange={(e) => { setTaskDescription(e.target.value); setFormErrors(f => ({...f, taskDescription: undefined})); }}
                             placeholder="Describe the web application or project you want to build..."
                             className={`w-full px-3 py-1.5 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                                 formErrors.taskDescription ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                             }`}
                             disabled={isGeneratingPlan}
                         />
                         {formErrors.taskDescription && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.taskDescription}</p>}
                     </div>

                      {/* Column 2: Template & Duration */}
                     <div className="md:col-span-1 space-y-3">
                         <div>
                             <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                 Technology/Template <span className='text-red-500'>*</span>
                             </label>
                             <input
                                 type="text"
                                 id="template"
                                 name="template"
                                 value={template}
                                 onChange={(e) => { setTemplate(e.target.value); setFormErrors(f => ({...f, template: undefined})); }}
                                 placeholder="e.g., React, Next.js, Vue, Python Flask"
                                 className={`w-full px-3 py-1.5 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                                     formErrors.template ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                                 }`}
                                 disabled={isGeneratingPlan}
                             />
                              {formErrors.template && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.template}</p>}
                         </div>
                         <div>
                              <label htmlFor="automationDuration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Project Duration (Days) <span className='text-red-500'>*</span>
                              </label>
                               <input
                                  type="number"
                                  id="automationDuration"
                                  name="automationDuration"
                                  value={automationDuration}
                                  onChange={(e) => { setAutomationDuration(e.target.value); setFormErrors(f => ({...f, automationDuration: undefined})); }}
                                  min="2" max="30" step="1"
                                  className={`w-full px-3 py-1.5 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 ${
                                      formErrors.automationDuration ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                                  }`}
                                  disabled={isGeneratingPlan}
                              />
                              {formErrors.automationDuration && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.automationDuration}</p>}
                         </div>
                     </div>

                     {/* Column 3: Action Button */}
                     <div className="md:col-span-1 flex flex-col justify-center items-center md:items-end pt-3 md:pt-0">
                         <button
                             onClick={handleGeneratePlan}
                             disabled={!isFormValid || isGeneratingPlan || isGitHubOperating}
                             className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 w-full md:w-auto transition-colors ${
                                 (!isFormValid || isGeneratingPlan || isGitHubOperating)
                                     ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                                     : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                             }`}
                             title={!isFormValid ? 'Please fill out the form correctly.' : (isGeneratingPlan ? 'Generating...' : 'Generate the project development plan')}
                         >
                             {isGeneratingPlan ? (
                                 <FiLoader className="animate-spin -ml-1 mr-2 h-5 w-5" />
                             ) : (
                                 <FiClipboard className="-ml-1 mr-2 h-5 w-5" />
                             )}
                             {isGeneratingPlan ? 'Generating Plan...' : 'Generate Plan'}
                         </button>
                     </div>
                 </div>
            </div>

             {/* Plan Display Area OR Loading/Placeholder */}
             <div className="flex-1 overflow-y-auto min-h-0 relative">
                 {isGeneratingPlan && (
                     <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900/80 flex items-center justify-center z-10">
                         <FiLoader className="animate-spin text-blue-500 w-10 h-10" />
                         <span className="ml-3 text-gray-700 dark:text-gray-300">Generating plan...</span>
                     </div>
                 )}
                 {projectPlan && !isGeneratingPlan && (
                     <>
                        <ProjectPlanDisplay plan={projectPlan} />
                        {/* Add Workflow Button - Only show if plan exists and workflow doesn't */}
                        {workflowExists === false && (
                             <div className="sticky bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-white dark:from-gray-900 via-white/90 dark:via-gray-900/90 to-transparent flex justify-end">
                                <button
                                    onClick={handleCreateAutomationWorkflow}
                                    disabled={isGitHubOperating || workflowExists !== false}
                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-150 ease-in-out ${
                                        (isGitHubOperating || workflowExists !== false)
                                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                                    }`}
                                    title={workflowExists === true ? 'Workflow already exists' : (isGitHubOperating ? 'Processing...' : 'Create the daily workflow file in this repo')}
                                >
                                    {isGitHubOperating ? <FiLoader className="animate-spin mr-2 h-4 w-4" /> : <FiGithub className="mr-2 h-4 w-4" />}
                                    {isGitHubOperating ? 'Creating...' : 'Create Workflow File'}
                                </button>
                             </div>
                        )}
                     </>
                 )}
                 {!projectPlan && !isGeneratingPlan && !generationError && (
                     <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-center p-6">
                         Fill the form above and click "Generate Plan" to create a day-by-day project breakdown.
                    </div>
                 )}
             </div>


            {/* Optional Log Output Area (Can be removed or kept small) */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto"> {/* Limited height */}
                 <div className="p-2 bg-gray-50 dark:bg-gray-800 flex items-center justify-between flex-shrink-0 sticky top-0">
                    <h3 className="text-xs font-semibold flex items-center text-gray-600 dark:text-gray-400">
                        <FiTerminal className="mr-2" /> Status Logs
                    </h3>
                    <button  disabled={logs.length === 0} className="p-1 rounded text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                        <FiTrash2 size={12} />
                    </button>
                </div>
                <div ref={logContainerRef} className="p-2 font-mono text-[11px] leading-tight">
                    {logs.length > 0 ? logs.map((log, index) => ( <div key={index} className={`whitespace-pre-wrap break-words ${ log.type === 'error' ? 'text-red-500 dark:text-red-400' : log.type === 'success' ? 'text-green-500 dark:text-green-400' : 'text-gray-600 dark:text-gray-400' }`}>{log.message}</div>)) : ( <div className="text-xs text-center text-gray-400 dark:text-gray-500 p-2">Status messages will appear here.</div> )}
                 </div>
            </div>
        </div>
    );
};

export default AutomationTab;