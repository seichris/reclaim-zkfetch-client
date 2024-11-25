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

      // Check if we have a cookie header
      const hasCookie = requestHeaders.some(h => h.name.toLowerCase() === 'cookie');
      
      // If no cookie header found, try to get it from document.cookie
      if (!hasCookie) {
        console.log('No cookie header found in request');
      }

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
      ["requestHeaders", "extraHeaders"]
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
    
    chrome.tabs.create({ 
      url: 'https://dev.reclaimprotocol.org/new-application' 
    }, (tab) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: (request) => {
              console.log('Starting form fill with request:', request);

              const fillForm = async () => {
                // Step 1: Click zkFetchApp button
                const zkFetchBtn = Array.from(document.querySelectorAll('button'))
                  .find(button => button.textContent.includes('zkFetchApp'));
                console.log('Found zkFetchApp button:', zkFetchBtn);
                
                if (zkFetchBtn) {
                  zkFetchBtn.click();
                  
                  setTimeout(() => {
                    // Step 2: Fill application name
                    const appNameInput = document.querySelector('input[placeholder="Application Name"]');
                    console.log('Found app name input:', appNameInput);
                    
                    if (appNameInput) {
                      appNameInput.value = "Network Request Proof";
                      appNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                      
                      // Step 3: Click Next button
                      const nextBtn = document.querySelector('button.stepper-next-button');
                      console.log('Found next button:', nextBtn);
                      
                      if (nextBtn) {
                        nextBtn.click();
                        
                        setTimeout(async () => {
                          // Step 4: Fill URL
                          const urlInput = document.querySelector('input[placeholder="https://api.reclaimprotocol/my-endpoint"]');
                          console.log('Found URL input:', urlInput);
                          
                          if (urlInput) {
                            urlInput.value = request.url;
                            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            // Debug: Log all headers
                            console.log('All request headers:', request.headers);
                            
                            // Step 5: Add header input pairs
                            const addHeaderBtn = Array.from(document.querySelectorAll('button'))
                              .find(button => button.getAttribute('aria-label') === 'Add header');
                            console.log('Found add header button:', addHeaderBtn);

                            // First, remove the default header row
                            const deleteButtons = document.querySelectorAll('button[aria-label="Delete header"]');
                            if (deleteButtons.length > 0) {
                              console.log('Removing default header row');
                              deleteButtons[0].click();
                              // Wait a bit for the deletion to complete
                              await new Promise(resolve => setTimeout(resolve, 200));
                            }

                            // Add pairs for each header
                            console.log('Adding header pairs for', request.headers.length, 'headers');
                            for(let i = 0; i < request.headers.length; i++) {
                              console.log('Adding header pair', i + 1);
                              addHeaderBtn.click();
                              // Wait between adding pairs
                              await new Promise(resolve => setTimeout(resolve, 200));
                            }

                            // Wait for all inputs to be created
                            await new Promise(resolve => setTimeout(resolve, 500));

                            // Now fill all the pairs
                            const allKeyInputs = document.querySelectorAll('input[placeholder="Header key"]');
                            const allValueInputs = document.querySelectorAll('input[placeholder="Header value"]');
                            const allSwitches = document.querySelectorAll('.chakra-switch__input');
                            
                            console.log('Found input pairs:', allKeyInputs.length);
                            console.log('Found switches:', allSwitches.length);
                            
                            request.headers.forEach((header, index) => {
                              console.log(`Filling header pair ${index}:`, header);
                              
                              if (allKeyInputs[index] && allValueInputs[index]) {
                                // Fill key and value
                                allKeyInputs[index].value = header.name;
                                allKeyInputs[index].dispatchEvent(new Event('input', { bubbles: true }));
                                
                                allValueInputs[index].value = header.value;
                                allValueInputs[index].dispatchEvent(new Event('input', { bubbles: true }));
                                
                                // Toggle the switch
                                if (allSwitches[index]) {
                                  console.log(`Clicking switch ${index}`);
                                  allSwitches[index].click();
                                  // Also dispatch change event to ensure the UI updates
                                  allSwitches[index].dispatchEvent(new Event('change', { bubbles: true }));
                                }
                              }
                            });
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