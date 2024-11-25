console.log('Background script starting...');

// Initialize state
const networkRequests = [];
let isRecording = false;

// Store listener references
let beforeSendHeadersListener = null;
let headersReceivedListener = null;
let completedListener = null;

// Function to start recording
function startRecording() {
  if (isRecording) {
    console.log('Already recording, ignoring start request');
    return;
  }
  isRecording = true;
  console.log('Starting network request recording');

  // Monitor request headers
  beforeSendHeadersListener = (details) => {
    console.log('Captured request:', details.url);
    try {
      const requestHeaders = details.requestHeaders ? details.requestHeaders.map(h => ({
        name: h.name,
        value: h.value
      })) : [];

      networkRequests.push({
        url: details.url,
        timestamp: details.timeStamp,
        type: details.type,
        statusCode: details.statusCode,
        requestHeaders: requestHeaders,
        responseHeaders: null
      });
      console.log('Total requests captured:', networkRequests.length);
    } catch (error) {
      console.error('Error capturing request:', error);
    }
  };

  // Monitor response headers
  headersReceivedListener = (details) => {
    try {
      const request = networkRequests.find(r => r.url === details.url);
      if (request) {
        request.responseHeaders = details.responseHeaders ? details.responseHeaders.map(h => ({
          name: h.name,
          value: h.value
        })) : [];
      }
    } catch (error) {
      console.error('Error capturing response headers:', error);
    }
  };

  // Add response body capture
  completedListener = async (details) => {
    try {
      const request = networkRequests.find(r => r.url === details.url);
      if (request && details.type === 'xmlhttprequest') {
        // Fetch the response body
        const response = await fetch(details.url);
        const text = await response.text();
        request.responseBody = text;
        console.log('Captured response body for:', details.url);
      }
    } catch (error) {
      console.error('Error capturing response body:', error);
    }
  };

  // Add the listeners with debug logs
  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      beforeSendHeadersListener,
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    );
    console.log('Added beforeSendHeaders listener');

    chrome.webRequest.onHeadersReceived.addListener(
      headersReceivedListener,
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );
    console.log('Added headersReceived listener');

    chrome.webRequest.onCompleted.addListener(
      completedListener,
      { urls: ["<all_urls>"] }
    );
    
    console.log('Added completed listener');
  } catch (error) {
    console.error('Error adding listeners:', error);
  }
}

// Function to stop recording
function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  console.log('Stopping network request recording');

  if (beforeSendHeadersListener) {
    chrome.webRequest.onBeforeSendHeaders.removeListener(beforeSendHeadersListener);
  }
  if (headersReceivedListener) {
    chrome.webRequest.onHeadersReceived.removeListener(headersReceivedListener);
  }
  if (completedListener) {
    chrome.webRequest.onCompleted.removeListener(completedListener);
  }
  networkRequests.length = 0;
  console.log('Cleared network requests');
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);
  
  if (message.type === 'START_RECORDING') {
    startRecording();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'STOP_RECORDING') {
    stopRecording();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SEARCH_REQUESTS') {
    console.log('Searching requests for text:', message.text);
    const searchText = message.text.toLowerCase();
    
    const matchingRequest = networkRequests
      .slice()
      .reverse()
      .find(request => {
        // Check URL
        if (request.url.toLowerCase().includes(searchText)) {
          return true;
        }
        // Check response headers
        if (request.responseHeaders && 
            request.responseHeaders.some(h => 
              (h.value + ' ' + h.name).toLowerCase().includes(searchText)
            )) {
          return true;
        }
        // Check response body
        if (request.responseBody && 
            request.responseBody.toLowerCase().includes(searchText)) {
          return true;
        }
        return false;
      });

    console.log('Found matching request:', matchingRequest);
    sendResponse({ 
      found: !!matchingRequest,
      matchingRequest 
    });
    return true;
  }

  if (message.type === 'OPEN_RECLAIM_PAGE') {
    console.log('Opening Reclaim page with request:', message.request);
    
    // Open Reclaim page directly
    chrome.tabs.create({ 
      url: 'https://dev.reclaimprotocol.org/new-application' 
    }, (tab) => {
      // Add listener for page load completion
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          // Execute form filling script
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: (request) => {
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
                        
                        // Step 4: Wait and fill URL and other details
                        setTimeout(() => {
                          const urlInput = document.querySelector('input[placeholder="https://api.reclaimprotocol/my-endpoint"]');
                          if (urlInput) {
                            urlInput.value = request.url;
                            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            // TODO: Add additional form filling for headers, response matches, etc.
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
            args: [message.request]
          });
        }
      });
      
      sendResponse({ success: true });
    });
    return true;
  }
});