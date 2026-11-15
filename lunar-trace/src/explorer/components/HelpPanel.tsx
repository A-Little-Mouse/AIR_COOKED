const ROWS: Array<[string, string]> = [
  ['Drag', 'Rotate around the selected body (orbit) · look around (free fly)'],
  ['Scroll  /  W S', 'Zoom in / out (orbit) · fly forward / back (free fly)'],
  ['A D', 'Rotate left / right (orbit) · strafe (free fly)'],
  ['Q E', 'Rotate up / down (orbit) · fly down / up (free fly)'],
  ['Z C', 'Roll the view'],
  ['Shift', 'Move 5× faster'],
  ['X', 'Move 20× slower (fine control)'],
  ['K', 'Toggle free-fly camera'],
  ['Click', 'Fly to a body, label or list entry'],
];

export default function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <section className="panel help" role="dialog" aria-label="Controls">
      <header><h2>Controls</h2><button className="btn icon" onClick={onClose} aria-label="Close">✕</button></header>
      <table><tbody>{ROWS.map(([k, v]) => (<tr key={k}><th>{k}</th><td>{v}</td></tr>))}</tbody></table>
      <p>Layout follows NASA&apos;s Eyes on the Solar System. In free fly your speed scales with the distance to the nearest body, so you slow down as you approach one.</p>
    </section>
  );
}
