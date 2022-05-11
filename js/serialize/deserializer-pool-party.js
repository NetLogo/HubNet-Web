import PoolParty from "./pool-party.js";

export default class DeserializerPoolParty extends PoolParty {

  // type InType  = Uint8Array
  // type OutType = Object[Any]

  // () => DeserializerPoolParty
  constructor() {
    super("/js/serialize/deserializer-pool.js", "deserialize", "deserializer");
  }

}
