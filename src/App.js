import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import "./App.css";
import { useState } from "react";
import { JsonEditor } from "json-edit-react";
import { Toaster, toast } from "react-hot-toast";
import { Reclaim } from "@reclaimprotocol/js-sdk";

function App() {
  const [proofData, setProofData] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  // replace with your own appID and appSecret from https://dev.reclaimprotocol.org/
  const reclaim = new ReclaimClient(
    "0xF218B59D7794e32693f5D3236e011C233E249105",
    "0xe7cc556f58d92618e04ebbd16744be753eb4d06d569590df341c89e25f6ecc9c"
  );
  const generateProof = async () => {
    setIsFetching(true);

    try {
      // graphql query to fetch sports data from shuffle.com (replace with your own query and url)
      const query = `
      query GetSports($language: Language) {
        sports {
          sports
          name
          nameTranslation: name(language: $language)
          weight
          __typename
        }
      }
    `;

    // Set query variables
    const variables = {
      language: "en",
    };

    // Set options for the fetch request
    const publicOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operationName: "GetSports",
        variables: variables,
        query: query,
      }),
    };


      // replace with your url to fetch data from (in this case, we are fetching sports data from shuffle.com)
      const url = "https://shuffle.com/graphql-sports";
      // you can add retry options to the fetch request (optional) (eg. retry 5 times with a delay of 1500ms between each retry)
      // ie const data = await reclaim.zkFetch(url, publicOptions, {}, 5, 1500);
      const data = await reclaim.zkFetch(url, publicOptions);
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

  /* 
  This function verifies the proof using the Reclaim SDK (offchain method)
  https://docs.reclaimprotocol.org/sdk-methods#verifysignedproofproof--promiseboolean
  */
  const verifyProof = async (proof) => {
    try {
      const isValid = await Reclaim.verifySignedProof(proof);
      if (isValid) {
        toast.success("Proof is valid");
      } else {
        toast.error("Proof is invalid");
      }
    } catch (error) {
      toast.error(`${error}`);
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
            <button
              className="bg-green-800 mt-8 hover:bg-green-700 lg:text-lg md:text-base sm:text-lg text-gray-200 font-semibold py-2 px-4 rounded"
              onClick={() => verifyProof(proofData)}
            >
              {" "}
              Verify Proof
            </button>
          )}
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
