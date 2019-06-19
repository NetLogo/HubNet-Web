window.localConnection = new RTCPeerConnection()
const channel = localConnection.createDataChannel("hubnet-web", { negotiated: true, id: 0 });

localConnection.onicecandidate = ({ candidate }) => {};

localConnection.ondatachannel = function(event) {};

channel.onmessage = function(event) {
  console.log(event.data);
};
channel.onopen = function() {};
channel.onclose = function() {};

localConnection.createOffer().then((offer) => localConnection.setLocalDescription(offer));

window.ownModelTypeChange = function(mode) {
  switch(mode) {
    case "library":
      document.getElementById("library-model").style.display = "";
      document.getElementById("upload-model").style.display  = "none";
      break;
    case "upload":
      document.getElementById("library-model").style.display = "none";
      document.getElementById("upload-model").style.display  = "";
      break;
    default:
      console.warn(`Unknown model source: ${mode}`);
  }
};

window.submitLaunchForm = function(elem) {

  const formData = new FormData(elem);

  const formDataPlus =
    { 'modelType':   formData.get('modelType')
    , 'sessionName': formData.get('sessionName')
    , 'password':    formData.get('password')
    };

  if (formDataPlus.password === "")
    delete formDataPlus.password;

  switch(formDataPlus.modelType) {
    case "library":
      const lm    = formData.get('libraryModel');
      const index = lm.lastIndexOf('/');
      formDataPlus.model     = lm
      formDataPlus.modelName = lm.slice(((index !== -1) ? index + 1 : 0));
      break;
    case "upload":
      formDataPlus.model     = formData.get('uploadModel');
      formDataPlus.modelName = "Get name from input later";
      break;
    default:
      console.warn(`Unknown model source: ${formDataPlus.modelType}`);
  }

  new Promise(
    function(resolve, reject) {

      if (formDataPlus.model instanceof File) {
        let reader = new FileReader();
        reader.onloadend = function(event) {
          resolve([formDataPlus, event.target]);
        };
        reader.readAsText(formDataPlus.model);
      } else {
        resolve([formDataPlus, formDataPlus.model])
      }

    }
  ).then(([fdp, fileEvent]) => {
    const modelUpdate = fileEvent.result !== undefined ? { model: fileEvent.result } : {}
    return Object.assign({}, fdp, modelUpdate);
  }).then((fddp) => {
    return Object.assign({}, fddp, { rtcDesc: JSON.stringify(localConnection.localDescription.toJSON()) });
  }).then((fdtp) => {

    const data =
      { method:  'POST'
      , headers: { 'Content-Type': 'application/json' }
      , body:    JSON.stringify(fdtp)
      };

    return fetch('/launch-session', data).then((response) => [fdtp, response]);

  }).then(([formDataLike, response]) => {

    if (response.status === 200) {

      response.json().then(function({ id, type, nlogoMaybe }) {

        const nlogo = type === "from-library" ? nlogoMaybe : formDataLike.model;

        const formFrame = document.getElementById("form-frame");
        const  nlwFrame = document.getElementById( "nlw-frame");

        formFrame.classList.add(   "hidden");
        nlwFrame .classList.remove("hidden");

        localConnection.onicecandidate =
          ({ candidate }) => {

            if (candidate !== undefined) {

              fetch(`/join/host-ice-stream/${id}`, { method: 'POST', body: candidate.toJSON() })

              const onICESSE = function(event) {
                const candies = JSON.parse(event.data);
                candies.forEach((candy) => localConnection.addIceCandidate(JSON.parse(candy)));
              };

              new EventSource(`/join/joiner-ice-stream/${id}`).addEventListener('message', onICESSE, false);

            }

          }

        const onConnSSE = function(event) {
          const cxs = JSON.parse(event.data);
          cxs.forEach((cx) => localConnection.setRemoteDescription(JSON.parse(cx)));
        };

        new EventSource(`/join/peer-stream/${id}`).addEventListener('message', onConnSSE, false);

      });

    } else {
      response.text().then(function(body) { alert(JSON.stringify(body)); });
    }

  });

  return false;

};
