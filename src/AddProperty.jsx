import Wizard from './Wizard';

const Ico = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

/** Properties are added from a 7/12 document: upload → check details → location → save. */
export default function AddProperty() {
  return (
    <div className="page addp">
      <div className="pagehead">
        <div className="title"><Ico d="M12 5v14M5 12h14" /><h1>Add property</h1></div>
        <a className="btn ghost sm" href="#/admin/props">← Properties</a>
      </div>
      <Wizard mode="add" />
    </div>
  );
}
