let selectedText = '';
let floatingButton = null;
let isRecording = false;

// Create floating button
const createFloatingButton = () => {
  const button = document.createElement('button');
  button.textContent = '🔍 Find in Network';
  button.style.cssText = `
    position: fixed;
    padding: 8px 16px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;

  // Add debug logging for button creation
  console.log('Creating floating button');
  
  button.addEventListener('click', function(e) {
    console.log('Button clicked!');
    e.stopPropagation();
    e.preventDefault();
    
    console.log('Button clicked, selected text:', selectedText);
    
    // First search for the text in existing requests
    chrome.runtime.sendMessage({ 
      type: 'SEARCH_REQUESTS', 
      text: selectedText 
    }, async (response) => {
      console.log('Got response from background:', response);
      if (response?.found && response?.matchingRequest) {
        console.log('Found matching request, opening Reclaim page');
        
        // Send message to open Reclaim page with the found request
        chrome.runtime.sendMessage({ 
          type: 'OPEN_RECLAIM_PAGE',
          request: {
            url: response.matchingRequest.url,
            method: response.matchingRequest.method || 'GET',
            headers: response.matchingRequest.requestHeaders,
            responseMatches: [{
              type: 'regex',
              value: selectedText
            }],
            responseRedactions: [{
              regex: selectedText
            }]
          }
        }, (reclaimResponse) => {
          console.log('Reclaim page response:', reclaimResponse);
          
          // Only stop recording and clear after Reclaim page is opened
          chrome.runtime.sendMessage({ 
            type: 'STOP_RECORDING' 
          }, () => {
            console.log('Stopped recording network requests');
          });

          floatingButton.remove();
        });
      } else {
        alert('No matching network request found for the selected text');
      }
    });
  });

  return button;
};

// Listen for text selection
document.addEventListener('mouseup', function handleMouseUp(event) {
  console.log('Mouse up event', { 
    isRecording, 
    isFloatingButton: event.target === floatingButton,
    hasSelection: window.getSelection().toString().trim().length > 0 
  });

  if (!isRecording || event.target === floatingButton) {
    console.log('Ignoring mouseup - not recording or clicked button');
    return;
  }

  const selection = window.getSelection();
  selectedText = selection.toString().trim();
  console.log('Selected text:', selectedText);
  
  if (floatingButton) {
    console.log('Removing existing button');
    floatingButton.remove();
  }

  if (selectedText) {
    console.log('Creating new button for text:', selectedText);
    floatingButton = createFloatingButton();
    document.body.appendChild(floatingButton);
    
    floatingButton.style.left = `${event.pageX + 10}px`;
    floatingButton.style.top = `${event.pageY + 10}px`;
  }
});

// Remove button when clicking elsewhere
document.addEventListener('mousedown', (event) => {
  if (floatingButton && 
      !floatingButton.contains(event.target) && 
      event.target !== floatingButton) {
    floatingButton.remove();
  }
});

// Add listener for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type);
  
  if (message.type === 'START_RECORDING') {
    console.log('Starting recording in content script');
    isRecording = true;
    sendResponse({ success: true });
  }
  if (message.type === 'STOP_RECORDING') {
    console.log('Stopping recording in content script');
    isRecording = false;
    if (floatingButton) {
      floatingButton.remove();
    }
    sendResponse({ success: true });
  }
  return true;
}); 