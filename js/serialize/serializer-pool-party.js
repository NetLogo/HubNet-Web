import PoolParty from "./pool-party.js";

export default class SerializerPoolParty extends PoolParty {

  // type InType  = Object[Any]
  // type OutType = Uint8Array

  // () => SerializerPoolParty
  constructor() {
    super("js/serialize/serializer-pool.js", "serialize", "serializer");
  }

}
