let lastImageSize = null; // Number

onmessage = (e) => {
  switch (e.data.type) {
    case "encode-blob":
      if (lastImageSize !== e.data.blob.size) {
        const reader = new FileReader();
        reader.onloadend = () => {
          lastImageSize = e.data.blob.size;
          postMessage(reader.result);
        };
        reader.readAsDataURL(e.data.blob);
      }
      break;
    default:
      console.warn("Unknown base64-encoder message type:", e.data.type, e);
  }
};
