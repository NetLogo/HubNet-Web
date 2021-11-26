// type Entry = (String, String, (String | Boolean)?)

class FurlingDescriptor {

  #fields   = undefined; // Object[Any]
  #name     = undefined; // String
  #path     = undefined; // Array[String]
  #pbMod    = undefined; // (String | Boolean)?
  #pbType   = undefined; // String
  #rootType = undefined; // String
  #type     = undefined; // String

  // (String, String, Entry, Object[Any], Array[String]) => FurlingDescriptor
  static new(type, rootType, entry, fields, path) {
    return new FurlingDescriptor( type, rootType, entry[0], entry[1], entry[2]
                                , fields, path);
  }

  // (String, String, String, String, (String | Boolean)?, Object[Any], Array[String]) => FurlingDescriptor
  constructor(type, rootType, name, pbType, pbMod, fields = {}, path = []) {
    this.#fields   = fields;
    this.#name     = name;
    this.#path     = path;
    this.#pbMod    = pbMod;
    this.#pbType   = pbType;
    this.#rootType = rootType;
    this.#type     = type;
  }

  // () => Entry
  get entry() {
    const suffix = (this.#pbMod !== undefined) ? [this.#pbMod] : [];
    return [this.#name, this.#pbType].concat(suffix);
  }

  // () => Object[Any]
  get fields() {
    return this.#fields;
  }

  // () => Array[String]
  get path() {
    return this.#path;
  }

  // () => String
  get rootType() {
    return this.#rootType;
  }

  // () => String
  get type() {
    return this.#type;
  }

  // (FurlingDescriptor) => FurlingDescriptor
  prefixPath = (prefix) => {
    return new FurlingDescriptor( this.#type, this.#rootType, this.#name
                                , this.#pbType, this.#pbMod, this.#fields
                                , prefix.concat(this.#path));
  };

}

// (Array[Entry]) => Object[Any]
const bareFieldsFrom = (entries) => {
  const f      = (b, c) => (c !== undefined) ? [b, c] : b;
  const fields = Object.fromEntries(entries.map(([a, b, c]) => [a, f(b, c)]));
  return fields;
};

// (Object[FurlingDescriptor]) => Object[
const fromDescriptors = (descs) => {
  return Object.fromEntries(
    Object.entries(descs).map(([k, v]) => [k, unfurl(v)])
  );
};

// (Array[Entry]) => Object[Any]
const fromEntriesInner = (entries) => {
  return fromEntries(entries).fields;
};

// (Array[Entry]) => Object[Any]
const fromEntries = (entries) => {
  return fieldsFrom(bareFieldsFrom(entries));
};

// (Object[Any], Entry) => Object[Any]
const unf1MapFrom = (fields, entry) => {
  const newFields = { key: entry[2], value: entry[1], ...fields };
  return unfurledFrom(newFields);
};

// (Object[Any], Entry) => Object[Any]
const unfMapFrom = (fields, entry) => {

  const newFields =
    { keys:   [entry[2], true]
    , values: [entry[1], true]
    , ...fields
    };

  return unfurledFrom(newFields);

};

// (Object[Any], Entry) => Object[Any]
const unf1PlotFrom = (fields) => {
  const newFields = { plotName: "string", ...fields };
  return unfurledFrom(newFields);
};

// (FurlingDescriptor) => Object[Any]
const unfurl = ({ entry, fields, type }) => {
  switch (type) {
    case "map": {
      return unfMapFrom(fields, entry);
    }
    case "map1": {
      return unf1MapFrom(fields, entry);
    }
    case "plain": {
      return unfurledFrom(fields);
    }
    case "plot1": {
      return unf1PlotFrom(fields);
    }
    default:
  }
  throw new Error(`Unknown unfurl descriptor type: ${type}`);
};

// (Object[Any]) => Object[Any]
const unfurledFrom = (fields) => {
  return fieldsFrom({ id: "uint32", ...fields });
};

// (Object[Any]) => Object[Any]
const fieldsFrom = (object) => {
  const fields =
    Object.fromEntries(
      Object.entries(object).map(
        ([key, value], i) => {
          if (!Array.isArray(value)) {
            return [key, { type: value, id: (i + 1) }];
          } else {
            const obj  = { type: value[0], id: (i + 1) };
            const mod  = value[1];
            const mods = (mod === true) ? { rule: "repeated" } : { keyType: mod };
            return [key, { ...obj, ...mods }];
          }
        }
      )
    );
  return { fields };
};

export { bareFieldsFrom, fieldsFrom, fromDescriptors, fromEntriesInner
       , fromEntries, FurlingDescriptor, unfurl };
