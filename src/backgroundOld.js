// Initialize when the service worker starts
chrome.runtime.onInstalled.addListener(() => {
    console.log('Background service worker installed');
  });
  
  let networkRequests = [];
  
  // Monitor network requests with filter
  chrome.webRequest.onCompleted.addListener(
    async (details) => {
      try {
        // Fetch the response body
        const response = await fetch(details.url);
        const text = await response.text();
        
        networkRequests.push({
          url: details.url,
          timestamp: details.timeStamp,
          type: details.type,
          statusCode: details.statusCode,
          responseBody: text
        });
        console.log('Network request captured:', details.url);
        console.log('Total requests captured:', networkRequests.length);
      } catch (error) {
        console.error('Error capturing request:', error);
      }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
  );
  
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_RECLAIM_PAGE') {
      // Acknowledge receipt of message
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'SEARCH_REQUESTS') {
      console.log('Searching requests for text:', message.text);
      console.log('Total requests to search:', networkRequests.length);
      
      const matchingRequests = networkRequests
        .slice()
        .reverse()
        .filter(request => 
          request.url.includes(message.text) || 
          (request.responseBody && request.responseBody.includes(message.text)) ||
          (request.url.includes('youtube.com/api') && 
           request.type === 'xmlhttprequest')
        );
  
      console.log('Found matching requests:', matchingRequests.length);
  
      if (matchingRequests.length > 0) {
        console.log('Opening Reclaim page with URL:', matchingRequests[0].url);
        // Open Reclaim page and fill URL
        chrome.tabs.create({ 
          url: 'https://dev.reclaimprotocol.org/new-application' 
        }, (tab) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (url) => {
                  const fillForm = async () => {
                    // Step 1: Click zkFetchApp button
                    const zkFetchBtn = Array.from(document.querySelectorAll('button'))
                      .find(button => button.textContent.includes('zkFetchApp'));
                    if (zkFetchBtn) {
                      zkFetchBtn.click();
                      
                      // Step 2: Wait and fill application name
                      setTimeout(() => {
                        const appNameInput = document.querySelector('input[placeholder="Application Name"]');
                        if (appNameInput) {
                          appNameInput.value = "Network Request Proof";
                          appNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                          
                          // Step 3: Click Next button
                          const nextBtn = document.querySelector('button.stepper-next-button');
                          if (nextBtn) {
                            nextBtn.click();
                            
                            // Step 4: Wait and fill URL input
                            setTimeout(() => {
                              const urlInput = document.querySelector('input[placeholder="https://api.reclaimprotocol/my-endpoint"]');
                              if (urlInput) {
                                urlInput.value = url;
                                urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                              }
                            }, 1000);
                          }
                        }
                      }, 1000);
                    }
                  };
  
                  // Start the form filling process
                  setTimeout(fillForm, 1000);
                },
                args: [matchingRequests[0].url]
              });
            }
          });
        });
      }
      sendResponse({ found: matchingRequests.length > 0 });
      return true;
    }
  });