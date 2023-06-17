class UploadResult {}

class Upload extends UploadResult {}

const InvalidUpload = new Upload();

class JsonPartial extends UploadResult {
  json = undefined; // String
  constructor(json) {
    super();
    this.json = json;
  }
}

class NlogoPartial extends UploadResult {
  nlogo = undefined; // String
  constructor(nlogo) {
    super();
    this.nlogo = nlogo;
  }
}

class ValidUpload extends Upload {

  #json  = undefined; // String
  #nlogo = undefined; // String

  // (String, String) => ValidUpload
  constructor(nlogo, json) {
    super();
    this.#json  = json;
    this.#nlogo = nlogo;
  }

  // () => String
  getJson = () => {
    return this.#json;
  };

  // () => String
  getNlogo = () => {
    return this.#nlogo;
  };

}

// (String) => Boolean
const isNlogo = (str) => {
  return typeof(str) === "string" && str.split("\n@#$#@#$#@").length === 12;
};

// (File) => Promise[UploadResult]
const processUpload = (file) => {

  const reader = new FileReader();

  const promise = new Promise(
    (resolve) => {
      reader.addEventListener("load", (e) => {
        resolve(e.target.result);
      });
    }
  );

  reader.readAsText(file);

  return promise.then(
    (text) => {
      try {
        const json = JSON.parse(text);
        if (json.type === "hubnet-web" && json.version === "hnw-alpha-1") {
          const fromHnwJson = (config) => {
            const nlogo = config.hnwNlogo;
            delete config.hnwNlogo;
            return new ValidUpload(nlogo, JSON.stringify(config));
          };
          return isNlogo(json.hnwNlogo) ? fromHnwJson(json)
                                        : new JsonPartial(text);
        } else {
          return InvalidUpload;
        }
      } catch (_) {
        return isNlogo(text) ? new NlogoPartial(text) : InvalidUpload;
      }
    }
  );

};

// (FileList, (Upload) => Unit, (String) => Unit) => Unit
const processUploads = (files, setUpload, setValidator) => {

  const numFiles = files.length;

  if (numFiles > 0) {

    processUpload(files[0]).then(
      (file1) => {

        if (file1 instanceof ValidUpload) {

          if (numFiles === 1) {
            setUpload(file1);
          } else {
            setValidator("Too many files uploaded");
            setUpload(InvalidUpload);
          }

        } else if (file1 === InvalidUpload) {
          setValidator("Invalid files for upload");
          setUpload(InvalidUpload);
        } else {

          if (numFiles === 2) {

            processUpload(files[1]).then(
              (file2) => {
                if (file1 instanceof NlogoPartial && file2 instanceof JsonPartial) {
                  setUpload(new ValidUpload(file1.nlogo, file2.json));
                } else if (file1 instanceof JsonPartial && file2 instanceof NlogoPartial) {
                  setUpload(new ValidUpload(file2.nlogo, file1.json));
                } else {
                  setValidator("Multi-file uploads must consist of one NLOGO file and one JSON file");
                  setUpload(InvalidUpload);
                }
              }
            );

          } else if (numFiles < 2) {
            setValidator("Not enough files uploaded");
            setUpload(InvalidUpload);
          } else {
            setValidator("Too many files uploaded");
            setUpload(InvalidUpload);
          }

        }
      }
    );

  } else {
    setValidator("No files selected for upload");
    setUpload(InvalidUpload);
  }

};

export { InvalidUpload, ValidUpload, processUploads, Upload };
