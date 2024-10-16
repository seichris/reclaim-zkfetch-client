import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import "./App.css";
import { useState } from "react";
import { JsonEditor } from "json-edit-react";
import { Toaster, toast } from "react-hot-toast";

function App() {
  const [proofData, setProofData] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  // replace with your own appID and appSecret from https://dev.reclaimprotocol.org/
  const reclaim = new ReclaimClient(
    process.env.REACT_APP_RECLAIM_APP_ID,
    process.env.REACT_APP_RECLAIM_APP_SECRET,
  );
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

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <main className="flex min-h-screen flex-col items-center justify-between p-8 pt-12 gap-4 bg-black">
        <div className="z-10 w-full flex flex-col gap-4 items-center justify-center font-mono text-sm">
          <h2 className="text-slate-300 text-sm lg:text-4xl md:text-3xl sm:text-xl xs:text-xs text-nowrap">
            Welcome to Reclaim Protocol (zkFetch)
          </h2>
          <h4 className="text-slate-400 text-sm lg:text-xl md:text-lg sm:text-lg xs:text-xs">
            This demo uses{" "}
            <span className="text-slate-300 underline">
              <a
                href="https://www.npmjs.com/package/@reclaimprotocol/zk-fetch"
                target="_blank"
                rel="noreferrer"
              >
                {" "}
                @reclaimprotocol/zk-fetch{" "}
              </a>
            </span>{" "}
            to fetch data{" "}
          </h4>

          <button
            className="bg-blue-500 mt-8 hover:bg-blue-700 lg:text-lg md:text-base sm:text-lg text-gray-200 font-semibold py-2 px-4 rounded"
            onClick={generateProof}
          >
            {isFetching ? "Fetching..." : "Generate Proof"}
          </button>
          {proofData && !isFetching && (
            <>
              <h3 className="text-slate-300 text-sm lg:text-2xl md:text-xl sm:text-lg xs:text-xs mt-8 text-white ">
                Proof Received
              </h3>

              <JsonEditor
                rootName="proof"
                className="p-4"
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
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default App;
