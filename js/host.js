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
}

window.submitLaunchForm = function(elem) {

  const formData = new FormData(elem);

  const formDataPlus =
    { 'modelType':   formData.get('modelType')
    , 'sessionName': formData.get('sessionName')
    , 'password':     formData.get('password')
    };

  if (formDataPlus.password === "")
    delete formDataPlus.password;

  switch(formDataPlus['modelType']) {
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
      console.warn(`Unknown model source: ${formDataPlus['modelType']}`);
  }

  new Promise(
    function(resolve, reject) {

      if (formDataPlus.model instanceof File) {
        let reader = new FileReader();
        reader.onloadend = function(event) {
          resolve(event.target);
        };
        reader.readAsText(formDataPlus.model);
      } else {
        resolve(formDataPlus.model)
      }

    }
  ).then(function(fileEvent) {

    if (fileEvent.result) {
      formDataPlus.model = fileEvent.result;
    }

    const data =
      { method:  'POST'
      , headers: { 'Content-Type': 'application/json' }
      , body:    JSON.stringify(formDataPlus)
      };

    return fetch('/launch-session', data);

  }).then(function(response) {

    if (response.status === 200) {
      response.text().then(function(body) { console.log(body); });
    } else {
      response.text().then(function(body) { alert(JSON.stringify(body)); });
    }

  });

  return false;

};
