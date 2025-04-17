import React, { useState, useEffect, useRef } from 'react';

const Browser = ({ initialUrl = 'https://wikipedia.com' }) => { // Using Bing as Google often blocks iframes
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // State to show errors
  const iframeRef = useRef(null); // Ref to access iframe if needed

  useEffect(() => {
    if (initialUrl !== currentUrl) {
      setInputValue(initialUrl);
      setCurrentUrl(initialUrl);
      setLoading(true);
      setError(null);
    }
  }, [initialUrl]); // Dependency array includes the prop

  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null); // Clear previous errors

    let urlToLoad = inputValue.trim();
    if (!urlToLoad) {
        // Optionally handle empty input (e.g., clear iframe or show message)
        setCurrentUrl('');
        setLoading(false);
        return;
    }

    // Basic check: add https:// if scheme is missing (more robust validation could be added)
    if (!/^https?:\/\//i.test(urlToLoad)) {
      urlToLoad = 'https://' + urlToLoad;
      // Update input value as well for consistency, avoids confusion
      setInputValue(urlToLoad);
    }

    // Only reload if the URL is actually different
    if (urlToLoad !== currentUrl) {
      setCurrentUrl(urlToLoad);
      setLoading(true);
    }
  };

  // Handle successful iframe load
  const handleLoad = () => {
    setLoading(false);
    setError(null); // Clear error on successful load
    // Potential issue: This might fire even if the loaded content is an
    // error page from the website (like a 404) or a blank page due
    // to X-Frame-Options. Detecting *true* success is difficult.
  };

  // Handle iframe load errors (limited effectiveness for security blocks)
  const handleError = (e) => {
    setLoading(false);
    setError(`Failed to load ${currentUrl}. The site may not allow embedding (due to X-Frame-Options or Content-Security-Policy headers) or might be unavailable.`);
    console.error("Iframe load error event:", e);
    // You could try setting currentUrl to '' here if you want the iframe removed on error
    // setCurrentUrl('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', border: '1px solid #ccc', overflow: 'hidden', backgroundColor: '#f9f9f9' }}>
      {/* Address Bar Area */}
      <div style={{ padding: '10px', backgroundColor: '#eee', borderBottom: '1px solid #ccc', flexShrink: 0 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex' }}>
          <input
            type="text" // Use text for flexibility, protocol added in submit logic
            value={inputValue}
            onChange={handleChange}
            placeholder="Enter URL (e.g., example.com)"
            style={{ flexGrow: 1, padding: '8px', fontSize: '14px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            aria-label="Website URL"
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
            disabled={loading} // Disable button while loading
          >
            {loading ? 'Loading...' : 'Go'}
          </button>
        </form>
      </div>

       {/* Content Area (Iframe / Loader / Error) */}
       <div style={{ flexGrow: 1, position: 'relative', backgroundColor: 'white' }}>
            {/* Loading Indicator */}
            {loading && currentUrl && (
              <div
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 2,
                }}
              >
                <p style={{ padding: '20px', backgroundColor: '#eee', borderRadius: '5px' }}>Loading {currentUrl}...</p>
              </div>
            )}

            {/* Error Message Display */}
            {error && (
               <div
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', zIndex: 2, color: '#dc3545', padding: '20px', textAlign: 'center'
                }}
              >
                 <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Content Load Error</p>
                 <p style={{ fontSize: '0.9em' }}>{error}</p>
              </div>
            )}

           {/* Iframe - Render only if there's a URL and no overriding error */}
           {currentUrl && !error && (
                <iframe
                    ref={iframeRef}
                    key={currentUrl} // Adding key helps React properly reset the iframe on src change
                    src={currentUrl}
                    title="Website Viewer"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      // Optionally hide iframe visually if loading overlay is showing, though opacity is handled by overlay
                      // visibility: loading ? 'hidden' : 'visible',
                      display: error ? 'none' : 'block' // Hide iframe completely if error overlay is shown
                    }}
                    onLoad={handleLoad}
                    onError={handleError}
                    // WARNING: Sandbox attribute restricts functionality significantly.
                    // Many sites require scripts, forms, popups etc.
                    // Removing sandbox increases security risks if embedding untrusted sites.
                    // Test with and without, or with specific permissions like below:
                    // sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    // For sites like Google/Bing you might need to remove sandbox completely,
                    // but understand the security implications.
                    // sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
           )}
           {/* Placeholder if no URL is loaded */}
           {!currentUrl && !loading && !error && (
               <div style={{ padding: '40px', textAlign: 'center', color: '#666', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p>Enter a URL above and click "Go" to load a website.</p>
               </div>
           )}
        </div>

       {/* Important Note Area */}
       <div style={{ padding: '8px 10px', backgroundColor: '#fff3cd', color: '#856404', fontSize: '12px', borderTop: '1px solid #ccc', flexShrink: 0, lineHeight: '1.4'}}>
          <strong>Important Note:</strong> Many websites (like Google, Facebook, etc.) explicitly block embedding in iframes using `X-Frame-Options` or `Content-Security-Policy` headers for security. These sites will likely appear blank, show a connection error, or display the site's own error message inside the frame. This component can only display sites that permit embedding.
       </div>
    </div>
  );
};

export default Browser;