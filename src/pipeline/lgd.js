// Official village list: the Local Government Directory (LGD) of India — every Maharashtra village with its code,
// taluka (sub-district) and district. The village code printed on a 7/12 is the LGD code, so the code alone tells us
// which village, taluka and district a 7/12 belongs to. The file in /public/data comes from the public LGD village
// directory (a 2022 copy: new or renamed villages need a refresh; codes themselves do not change).
let table = null;
let loading = null;

export const lgdLoaded = () => !!table;
export function loadLgd() {
  if (table) return Promise.resolve(table);
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/lgd-mh.json`)
      .then((r) => r.json())
      .then((j) => { table = j; return j; })
      .catch(() => { loading = null; return null; });
  }
  return loading;
}
/** [village, taluka, district] in English, or undefined (also undefined until the list has loaded). */
export const lgdVillage = (code) => (table ? table[String(code).trim()] : undefined);
