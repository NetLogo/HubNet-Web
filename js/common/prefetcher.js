export default class Prefetcher {

  #promises = {}; // Object[Number, Promise[String]]

  // (Boolean) => Prefetcher
  constructor(isHost) {

    const hashes =
      [    37695712 // Bug Hunt/poppyfield.jpg (from '.nlogox' resource bundle)
      ,  -448920965 // Bug Hunt/poppyfield.jpg
      , -1899347901 // Bug Hunt/glacier.jpg
      ,  1152521345 // Bug Hunt/seashore.jpg
      ,  1403011093 // Guppy Spots/aquarium.jpg
      ,  -996662878 // Guppy Spots/underwater.jpg
      ];

    if (isHost) {
      this.#promises = Object.fromEntries(hashes.map((hash) => [hash, Promise.resolve(`${hash}`)]));
    } else {
      hashes.forEach(
        async (hash) => {
          const response = await fetch(`/prefetched/${hash}`);
          const blob     = await response.blob();
          const promise =
            new Promise(
              (resolve, reject) => {
                const reader   = new FileReader();
                reader.onload  = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              }
            );
          this.#promises[hash] = promise;
        }
      );
    }

  }

  // (Number) => Promise[String]
  get = (hash) => {
    return this.#promises[hash];
  };

}
