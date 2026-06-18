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

class NlogoxPartial extends UploadResult {
  nlogox = undefined; // String
  constructor(nlogox) {
    super();
    this.nlogox = nlogox;
  }
}

class ValidUpload extends Upload {

  #type  = undefined; // "nlogo" | "nlogox"
  #json  = undefined; // String
  #model = undefined; // String

  // (String, String) => ValidUpload
  constructor(type, model, json) {
    super();
    this.#type  = type;
    this.#json  = json;
    this.#model = model;
  }

  getType = () => {
    return this.#type;
  };

  // () => String
  getJson = () => {
    return this.#json;
  };

  // () => String
  getModel = () => {
    return this.#model;
  };

}

// (String) => Boolean
const isNlogo = (str) => {
  return typeof(str) === "string" && str.split("\n@#$#@#$#@").length === 12;
};

// (String) => Boolean
const isNlogox = (str) => {
  return typeof(str) === "string" && str.trim().startsWith("<?xml");
};

// (String) => Document
const nlogoXmlToDoc = (nlogox) => {
  const parser = new DOMParser();
  return parser.parseFromString(nlogox, "text/xml");
};

// (String) => String
const stripXmlCdata = (text) => {
  const CDATA_START = "<![CDATA[";
  const CDATA_END   = "]]>";
  if (text.startsWith(CDATA_START) && text.endsWith(CDATA_END))
    return text.slice(CDATA_START.length, -1 * CDATA_END.length);
  else
    return text;
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
      if (isNlogox(text)) {
        try {
          const nlogoDoc      = nlogoXmlToDoc(text);
          const modelElement  = nlogoDoc.querySelector("model");
          const configElement = modelElement.querySelector("hubnet-web-config");
          const config        =
            configElement === null ? undefined : stripXmlCdata(configElement.innerHTML);
          return new ValidUpload("nlogox", text, config);
        } catch (_) {
          return new NlogoxPartial(text);
        }
      } else {
        try {
          const json = JSON.parse(text);
          if (json.type === "hubnet-web" && json.version === "hnw-alpha-1") {
            const fromHnwJson = (config) => {
              const nlogo = config.hnwNlogo;
              delete config.hnwNlogo;
              return new ValidUpload("nlogo", nlogo, JSON.stringify(config));
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
                  setUpload(new ValidUpload("nlogo", file1.nlogo, file2.json));
                } else if (file1 instanceof JsonPartial && file2 instanceof NlogoPartial) {
                  setUpload(new ValidUpload("nlogo", file2.nlogo, file1.json));
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
