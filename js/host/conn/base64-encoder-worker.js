let lastBlob = new Blob([]); // Blob

// (Blob) => Promise[Boolean]
const checkIsNew = (blob) => {
  return Promise.all([blob.arrayBuffer(), lastBlob.arrayBuffer()]).
    then(
      ([newBuffer, oldBuffer]) => {

        if (newBuffer.byteLength !== oldBuffer.byteLength) {
          return true;
        }

        const newArr = new Uint8Array(newBuffer);
        const oldArr = new Uint8Array(oldBuffer);

        for (let i = 0; i < newArr.byteLength; i++) {
          if (newArr[i] !== oldArr[i]) {
            return true;
          }
        }

        return false;

      }
    );
};

// (MessageEvent) => Unit
onmessage = (e) => {

  switch (e.data.type) {

    case "encode-blob": {
      checkIsNew(e.data.blob).
        then(
          (isNew) => {
            if (isNew) {
              const reader = new FileReader();
              reader.onloadend = () => {
                lastBlob = e.data.blob;
                e.ports[0].postMessage(reader.result);
              };
              reader.readAsDataURL(e.data.blob);
            }
          }
        );
      break;
    }

    default: {
      console.warn("Unknown base64-encoder message type:", e.data.type, e);
    }

  }

};
