'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import FileBar from '../../components/FileBar';
import Topbar from '../../components/Topbar';
import ChatSection from '../../components/ChatSection';
import Bottombar from '../../components/Bottombar';
import HomeTabContent from '../../components/HomeTabContent';
import CodeDisplay from '../../components/CodeDisplay';
import { FiLoader } from 'react-icons/fi';
import { useGitHubApi } from '../../hooks/useGitHubApi';
import RepoScanner from '../../components/RepoScanner'; 
import AutomationTab from '../../components/Automation';
import Browser from '../../components/Browser'; // Import the Browser component

const GITHUB_ACCESS_TOKEN_KEY = 'github_access_token';

const PlaceholderView = () => (
  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
  <img
    src="logo.svg"
    alt="No Repo Selected"
    className="w-[300px] h-[300px] mb-4 text-gray-500 opacity-50"
  />
  <p className="text-lg">Please select a repository from the dropdown.</p>
</div>
);


export default function Home() {
    const [accessToken, setAccessToken] = useState(null);
    const [sessionStatus, setSessionStatus] = useState('loading');
    const [userInfo, setUserInfo] = useState(null);
    const [activeTab, setActiveTab] = useState('Home');
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [userRepos, setUserRepos] = useState([]);
    const [isRepoListLoading, setIsRepoListLoading] = useState(false);
    const [repoListError, setRepoListError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState(null);
    const [isFileLoading, setIsFileLoading] = useState(false);
    const [fileError, setFileError] = useState(null);
    const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
    const prevRepoIdRef = useRef(null);

    const {
        clearCommitError
    } = useGitHubApi(accessToken, selectedRepo?.full_name);

    const handleClearFile = useCallback(() => {
        if (selectedFile || fileContent || fileError || isFileLoading || isCommitModalOpen) {
            setSelectedFile(null);
            setFileContent(null);
            setFileError(null);
            setIsFileLoading(false);
            clearCommitError();
            setIsCommitModalOpen(false);
        }
    }, [selectedFile, fileContent, fileError, isFileLoading, isCommitModalOpen, clearCommitError]);

    const clearAuthState = useCallback((errorMsg = null) => {
        try {
          localStorage.removeItem(GITHUB_ACCESS_TOKEN_KEY);
        } catch (e) {
          console.error("Failed to remove token from localStorage:", e);
        }
        setAccessToken(null);
        setUserInfo(null);
        setSessionStatus('unauthenticated');
        setUserRepos([]);
        setSelectedRepo(null);
        setRepoListError(errorMsg);
        handleClearFile();
    }, [handleClearFile]);

    const handleLogin = useCallback(() => {
        if (window.electronAPI && typeof window.electronAPI.loginGithub === 'function') {
          clearAuthState();
          window.electronAPI.loginGithub();
        } else {
          console.error('Electron API (window.electronAPI or loginGithub) not found.');
          clearAuthState("Could not initiate login: Electron API unavailable.");
        }
    }, [clearAuthState]);

    useEffect(() => {
        let unsubscribe = null;
        let cleanupPerformed = false;
        let initialToken = null;

        // setAccessToken("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i");
        // setSessionStatus('authenticated');

        try {
          initialToken = localStorage.getItem(GITHUB_ACCESS_TOKEN_KEY);
          if (initialToken) {
            setAccessToken(initialToken);
            setSessionStatus('authenticated');
          } else {
            setSessionStatus('unauthenticated');
          }
        } catch (e) {
          console.error("Failed to access localStorage on mount:", e);
          setSessionStatus('unauthenticated');
        }

        const handleToken = (token) => {
          if (cleanupPerformed) return;
          if (token) {
            try {
              localStorage.setItem(GITHUB_ACCESS_TOKEN_KEY, token);
            } catch (e) {
              console.error("Failed to save token to localStorage:", e);
            }
            setAccessToken(token);
            setSessionStatus('authenticated');
            setRepoListError(null);
          } else {
            clearAuthState("Logged out or token became invalid.");
          }
        };

        if (window.electronAPI && typeof window.electronAPI.onGithubToken === 'function') {
          unsubscribe = window.electronAPI.onGithubToken(handleToken);
        } else {
          console.warn('Page: Electron API or onGithubToken function not found. Persistence/Login might not work correctly.');
          if (!initialToken) {
              setSessionStatus('unauthenticated');
          }
        }

        return () => {
          cleanupPerformed = true;
          if (unsubscribe && typeof unsubscribe === 'function') {
            unsubscribe();
          }
        };
    }, [clearAuthState]);

    useEffect(() => {
        const fetchUserInfo = async () => {
          if (!accessToken || sessionStatus !== 'authenticated') {
            setUserInfo(null); return;
          }
          try {
            const response = await fetch('https://api.github.com/user', {
              headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
            });
            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                clearAuthState("Authentication failed (token invalid). Please log in again.");
              } else {
                throw new Error(`Failed to fetch user info (Status: ${response.status} ${response.statusText})`);
              }
              return;
            }
            const data = await response.json();
            setUserInfo({ name: data.name || data.login, image: data.avatar_url });
          } catch (err) {
            console.error('Page: Error fetching user info:', err);
            if (sessionStatus === 'authenticated') { setUserInfo(null); }
          }
        };
        fetchUserInfo();
    }, [accessToken, sessionStatus, clearAuthState]);

    useEffect(() => {
        const fetchUserRepos = async () => {
          if (accessToken && sessionStatus === 'authenticated') {
            setIsRepoListLoading(true);
            setRepoListError(null);
            try {
              // Ensure 'visibility=all' if you need private repos too
              const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&visibility=all', {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
              });
              if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                  clearAuthState("Authentication failed fetching repositories. Please log in again.");
                  return;
                }
                let errorMsg = `Failed to fetch repositories (Status: ${response.status})`;
                try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.message || response.statusText}`; } catch (_) {}
                throw new Error(errorMsg);
              }
              const data = await response.json();
              setUserRepos(data);

              if (selectedRepo && !data.some(repo => repo.id === selectedRepo.id)) {
                 setSelectedRepo(null);
                 handleClearFile();
               } else if (data.length === 0) {
                  setSelectedRepo(null);
               }
            } catch (err) {
              if (sessionStatus === 'authenticated') {
                console.error('Page: Error fetching repos:', err);
                setRepoListError(err.message);
                setUserRepos([]);
                setSelectedRepo(null);
                handleClearFile();
              }
            } finally {
              if (sessionStatus === 'authenticated') {
                setIsRepoListLoading(false);
              }
            }
          } else if (sessionStatus !== 'loading') {
              setUserRepos([]);
              setSelectedRepo(null);
              setRepoListError(null);
              setIsRepoListLoading(false);
          }
        };
        fetchUserRepos();
    }, [accessToken, sessionStatus, clearAuthState, handleClearFile, selectedRepo]);

    const handleFileSelect = useCallback((file) => {
        // Allow selecting a file path string directly (from RepoScanner)
        if (typeof file === 'string') {
            
             if (selectedFile?.path === file) return; // Avoid re-selecting same path
             setSelectedFile({ path: file, name: file.split('/').pop(), sha: null }); // Create a partial file object
             setFileContent(null);
             setFileError(null);
             setIsFileLoading(false); // Don't set loading=true as we don't have SHA to fetch yet
             clearCommitError();
             setIsCommitModalOpen(false);
             return; // Exit early
        }

        // Original logic for full file objects (from FileBar)
        if (file?.path && file?.name && file?.sha) {
            if (selectedFile?.path === file.path && selectedFile?.sha === file.sha) {
                return;
            }
            setSelectedFile(file);
            setFileContent(null);
            setFileError(null);
            setIsFileLoading(true);
            clearCommitError();
            setIsCommitModalOpen(false);
        } else {
            console.warn("Page: Invalid file object received for selection:", file);
            handleClearFile();
        }
    }, [handleClearFile, clearCommitError, selectedFile?.path, selectedFile?.sha]);

    const handleFileContentLoaded = useCallback((content, error, newSha) => {
        setIsFileLoading(false);
        if (error) {
            setFileError(error);
            setFileContent(null);
        } else {
            setFileContent(content);
            setFileError(null);
            if (newSha && selectedFile && newSha !== selectedFile.sha) {
                setSelectedFile(prevFile =>
                    prevFile ? { ...prevFile, sha: newSha } : null
                );
            }
        }
    }, [selectedFile]);


   

    useEffect(() => {
        const currentRepoId = selectedRepo?.id;
        if (currentRepoId !== prevRepoIdRef.current && prevRepoIdRef.current !== null) {
            handleClearFile();
        }
        prevRepoIdRef.current = currentRepoId;
    }, [selectedRepo, handleClearFile]);



    // ************************************************
    // ********* RENDER TAB CONTENT - MODIFIED ********
    // ************************************************
    const renderTabContent = () => {
        // --- Loading and Unauthenticated States (remain mostly unchanged) ---
        if (sessionStatus === 'loading') {
            return (
                <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <FiLoader size={32} className="animate-spin text-blue-500" />
                </div>
            );
        }
        if (sessionStatus === 'authenticated' && isRepoListLoading && userRepos.length === 0 && !repoListError) {
            return (
                <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <FiLoader size={32} className="animate-spin text-blue-500" />
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading repositories...</span>
                </div>
            );
        }

        // --- Render ALL tab contents, hide inactive ones with CSS ---
        return (
            <>
                {/* --- Home Tab --- */}
                <div style={{ display: activeTab === 'Home' ? 'flex' : 'none' }} className="flex flex-1 flex-col overflow-hidden">
                     <HomeTabContent
                        userRepos={userRepos} selectedRepo={selectedRepo} setSelectedRepo={setSelectedRepo}
                        isRepoListLoading={isRepoListLoading} repoListError={repoListError}
                        sessionStatus={sessionStatus} accessToken={accessToken}
                        onLoginClick={handleLogin}
                      />
                </div>

                {/* --- Code / Chat Tab Container --- */}
                <div style={{ display: (activeTab === 'Code' || activeTab === 'Chat') ? 'flex' : 'none' }} className="flex flex-1 overflow-hidden ">
                     {!selectedRepo && sessionStatus === 'authenticated' ? (
                        <div className="[.dark_&]:text-white [.dark_&]:bg-gray-800 flex flex-1 items-center justify-center p-6 text-center text-gray-500  bg-gray-50 dark:bg-gray-900">
                             {isRepoListLoading ? <FiLoader size={24} className="animate-spin text-blue-500" />
                                : repoListError ? <span className="text-red-500">Error loading repositories: {repoListError}</span>
                                : userRepos.length > 0 ? 
                                <PlaceholderView/>
                                : 'No repositories found or you may not have access.'}
                         </div>
                     ) : selectedRepo ? ( // Only render FileBar etc. if repo is selected
                         <>
                             <FileBar
                                 key={selectedRepo.id} // Reset FileBar when repo changes
                                 selectedRepo={selectedRepo.full_name}
                                 onFileSelect={handleFileSelect}
                                 selectedFile={selectedFile}
                                 onFileContentLoaded={handleFileContentLoaded}
                                 accessToken={accessToken}
                             />
                             <div className="flex-1 flex flex-col overflow-hidden">
                                 {/* Chat View (visible only if activeTab is 'Chat') */}
                                 <div style={{ display: activeTab === 'Chat' ? 'flex' : 'none' }} className="flex flex-1 flex-col overflow-hidden">
                                        <ChatSection
                                          selectedRepoFullName={selectedRepo.full_name}
                                          accessToken={accessToken}
                                          selectedFile={selectedFile}          
                                          context={fileContent}                
                                          onClearContext={handleClearFile}  
                                      />
                                  </div>
                                 {/* Code View (visible only if activeTab is 'Code') */}
                                 <div style={{ display: activeTab === 'Code' ? 'flex' : 'none' }} className="flex flex-1 flex-col overflow-hidden">
                                     <CodeDisplay
                                         selectedFile={selectedFile}
                                         repoFullName={selectedRepo.full_name}
                                         onClearFile={handleClearFile}
                                         accessToken={accessToken}
                                     />
                                 </div>
                             </div>
                         </>
                     ) : null // Should not happen if repo is required, but for safety
                     }
                </div>


                {/* --- Notifications Tab (RepoScanner) --- */}
                <div style={{ display: activeTab === 'Scanner' ? 'flex' : 'none' }} className="flex flex-1 flex-col overflow-hidden">
                     {/* Conditionally render based on repo selection *within* the persistent container */}
                     {!selectedRepo && sessionStatus === 'authenticated' ? (
                          <div className="flex flex-1 items-center justify-center p-6 text-center text-gray-500 [.dark_&]:text-white bg-gray-50 [.dark_&]:bg-gray-800">
                              {isRepoListLoading ? <FiLoader size={24} className="animate-spin text-blue-500 " />
                                  : repoListError ? <span className="text-red-500">Error: {repoListError}</span>
                                  : userRepos.length > 0 ? <PlaceholderView/>
                                  : 'No repositories found or you may not have access.'}
                          </div>
                     ) : selectedRepo ? (
                         // Add key to reset state if selectedRepo changes while on this tab
                          <RepoScanner
                              key={selectedRepo.id}
                              repoUrl={selectedRepo.full_name} // Pass the actual repo identifier
                              accessToken={accessToken}
                              setActiveTab={setActiveTab}
                              setSelectedFile={handleFileSelect} // Use the handler function
                          />
                     ) : null // Handles case where session is not authenticated yet
                     }
                </div>

                

                {/* --- Automation Tab --- */}
                <div style={{ display: activeTab === 'Automation' ? 'flex' : 'none' }} className="flex flex-1 flex-col overflow-hidden">
                    

                  {!selectedRepo && sessionStatus === 'authenticated' ? (
                          <div className="flex flex-1 items-center justify-center p-6 text-center text-gray-500 [.dark_&]:text-white bg-gray-50 [.dark_&]:bg-gray-800">
                              {isRepoListLoading ? <FiLoader size={24} className="animate-spin text-blue-500 " />
                                  : repoListError ? <span className="text-red-500">Error: {repoListError}</span>
                                  : userRepos.length > 0 ? <PlaceholderView/>
                                  : 'No repositories found or you may not have access.'}
                          </div>
                     ) : selectedRepo ? (
                      <AutomationTab 
                      repoFullName={selectedRepo?.full_name} 
                      accessToken={accessToken}
                      />
                     ) : null 
                     }


                </div>


                {/* --- Browser Tab --- */}
                <div style={{ display: activeTab === 'Browser' ? 'flex' : 'none' }} className="flex flex-1 flex-col overflow-hidden">
                    <Browser  /> {/* Replace with the desired URL */}
                </div>


            </>
        );
    };
    // ************************************************
    // ******* END RENDER TAB CONTENT - MODIFIED ******
    // ************************************************


    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="flex flex-1 flex-col overflow-hidden">
                    <Topbar
                        accessToken={accessToken}
                        userRepos={userRepos}
                        selectedRepo={selectedRepo}
                        setSelectedRepo={setSelectedRepo}
                        userInfo={userInfo}                        
                    />
                    <div className="flex flex-1 overflow-hidden">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
            <Bottombar />
            
        </div>
    );
}