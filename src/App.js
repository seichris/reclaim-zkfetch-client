import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import "./App.css";
import { useState, useEffect } from "react";
import { JsonEditor } from "json-edit-react";
import { Toaster, toast } from "react-hot-toast";

// replace with your own appID and appSecret from https://dev.reclaimprotocol.org/
const reclaim = new ReclaimClient(
  process.env.REACT_APP_RECLAIM_APP_ID,
  process.env.REACT_APP_RECLAIM_APP_SECRET,
  true
);

function App() {
  const [proofData, setProofData] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    // Check if we're opened for a Reclaim request
    if (window.location.hash === '#reclaim') {
      chrome.storage.local.get(['pendingReclaimRequest'], (result) => {
        if (result.pendingReclaimRequest) {
          console.log('Found pending Reclaim request:', result.pendingReclaimRequest);
          const request = result.pendingReclaimRequest;
          
          // Clear the stored request
          chrome.storage.local.remove(['pendingReclaimRequest']);
          
          // Generate the proof
          reclaim.zkFetch(
            request.url,
            {
              method: request.method,
              headers: request.headers
            },
            {
              responseMatches: request.responseMatches,
              responseRedactions: request.responseRedactions
            }
          ).then(data => {
            console.log('Proof generated:', data);
            setProofData(data);
            toast.success('Proof generated successfully!');
          }).catch(error => {
            console.error('Error generating proof:', error);
            toast.error('Failed to generate proof: ' + error.message);
          });
        }
      });
    }
  }, []); // Run once on mount

  const generateProof = async () => {
    setIsFetching(true);

    try {
      // replace with your url to fetch data from (in this case, we are fetching Crypto Global Market Data from coingecko)
      const url = "https://api.coingecko.com/api/v3/global";
      const data = await reclaim.zkFetch(url, {
        // public options for the fetch request 
        method: "GET",
      }, {
        /* 
          * The proof will match the response body with the regex pattern (search for the number of active cryptocurrencies in the response body)
          the regex will capture the number in the named group 'active_cryptocurrencies'. 
        */ 
        responseMatches: [
          {
            type: "regex",
            // the regex pattern to match the response body and capture the number of active cryptocurrencies 
            value: 'active_cryptocurrencies":(?<active_cryptocurrencies>[\\d\\.]+)'
          },
        ],
        responseRedactions: [{
          regex: 'active_cryptocurrencies":(?<active_cryptocurrencies>[\\d\\.]+)'
        }]
      });
      console.log(data);
      setProofData(data);
      setIsFetching(false);
      return data;
    } catch (error) {
      setIsFetching(false);
      toast.error(`${error?.message}`);
      console.error(error);
    }
  };

  const startNetworkCapture = async () => {
    try {
      console.log('Starting network capture...');
      // Check if we're in a Chrome extension context
      if (!chrome?.runtime?.sendMessage) {
        console.error('Not in Chrome extension context');
        toast.error('This feature is only available in the Chrome extension');
        return;
      }

      // Start recording network requests in background
      chrome.runtime.sendMessage({ type: 'START_RECORDING' }, async (response) => {
        console.log('Got response from background:', response);
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError);
          toast.error('Failed to start recording');
          return;
        }
        
        if (response?.success) {
          // Also send message to content script in current tab
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Error sending to content script:', chrome.runtime.lastError);
                return;
              }
              console.log('Content script response:', response);
            });
          }
          
          console.log('Successfully started recording');
          toast.success('Started capturing network requests. Please highlight text on the page to search.');
        }
      });
      
    } catch (error) {
      console.error('Error starting capture:', error);
      toast.error('Failed to start network capture: ' + error.message);
    }
  };

  // Add this to your existing message handlers in App.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_RECLAIM_PAGE') {
      console.log('Opening Reclaim page with request:', message.request);
      
      // Use the reclaim client to generate proof
      reclaim.zkFetch(
        message.request.url,
        {
          method: message.request.method,
          headers: message.request.headers
        },
        {
          responseMatches: message.request.responseMatches,
          responseRedactions: message.request.responseRedactions
        }
      ).then(data => {
        console.log('Proof generated:', data);
        setProofData(data);
        toast.success('Proof generated successfully!');
      }).catch(error => {
        console.error('Error generating proof:', error);
        toast.error('Failed to generate proof: ' + error.message);
      });

      sendResponse({ success: true });
      return true;
    }
  });

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-900 to-black">
        <div className="w-full max-w-4xl flex flex-col gap-8 items-center justify-center font-sans">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center">
            zkFetch Demo
          </h1>
          <h2 className="text-md md:text-lg text-slate-300 text-center max-w-2xl">
            This demo uses{" "}
            <a
              href="https://www.npmjs.com/package/@reclaimprotocol/zk-fetch"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 font-semibold hover:underline transition-colors duration-300"
            >
              @reclaimprotocol/zk-fetch
            </a>{" "}
            to fetch data from{" "}
            <a 
              href="https://api.coingecko.com/api/v3/global" 
              target="_blank" 
              rel="noreferrer"
              className="text-green-400 font-semibold hover:underline transition-colors duration-300"
            >
              CoinGecko API
            </a>{" "}
            and generate a proof
          </h2>

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            onClick={generateProof}
          >
            {isFetching ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Fetching...
              </span>
            ) : (
              "Generate Proof"
            )}
          </button>
          
          <button
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            onClick={startNetworkCapture}
          >
            Capture Network Request
          </button>
          
          {proofData && !isFetching && (
            <div className="w-full bg-gray-800 rounded-lg shadow-xl p-6 mt-8">
              <h3 className="text-2xl font-bold text-white mb-4">
                Proof Received
              </h3>
              <JsonEditor
                rootName="proof"
                data={proofData}
                viewOnly={true}
                restrictEdit={true}
                restrictAdd={true}
                restrictDelete={true}
                restrictDrag={true}
                theme={"githubDark"}
                maxWidth={"100%"}
                minWidth={"100%"}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default App;
