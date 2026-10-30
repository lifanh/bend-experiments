import Interpreter from './bend/interpreter.mjs';

export function initInterpreter() {
  const preset = document.querySelector('#interpreter-preset');
  const x = document.querySelector('#interpreter-x');
  const y = document.querySelector('#interpreter-y');
  const condition = document.querySelector('#interpreter-condition');
  const source = document.querySelector('#interpreter-source');
  const answer = document.querySelector('#interpreter-answer');
  const check = document.querySelector('#interpreter-check');
  const evaluation = document.querySelector('#interpreter-eval');
  const status = document.querySelector('#interpreter-status');

  // Build syntax only. Type checking and arithmetic belong to Bend.
  function expression() {
    const a = { $: 'Number', value: Number(x.value) };
    const b = { $: 'Number', value: Number(y.value) };
    const bool = { $: 'Boolean', value: condition.checked };
    const add = { $: 'Add', left: a, right: b };
    const less = { $: 'Less', left: a, right: b };
    switch (preset.value) {
      case 'compare': return { $: 'Less', left: add, right: { $: 'Multiply', left: a, right: b } };
      case 'nested': return { $: 'If', condition: bool, yes: { $: 'If', condition: less, yes: b, no: a }, no: add };
      case 'bad-add': return { $: 'Add', left: a, right: bool };
      case 'bad-branch': return { $: 'If', condition: bool, yes: a, no: less };
      case 'dead-branch': return { $: 'If', condition: bool, yes: add, no: { $: 'Add', left: a, right: { $: 'Boolean', value: false } } };
      default: return { $: 'If', condition: less, yes: add, no: { $: 'Multiply', left: a, right: b } };
    }
  }
  function format(node, level = 0) {
    if (node.$ === 'Number' || node.$ === 'Boolean') return String(node.value);
    if (node.$ === 'If') {
      const indent = '  '.repeat(level);
      return `if ${format(node.condition, level)}\n${indent}then ${format(node.yes, level + 1)}\n${indent}else ${format(node.no, level + 1)}`;
    }
    return `(${format(node.left, level)} ${{ Add: '+', Multiply: '×', Less: '<' }[node.$]} ${format(node.right, level)})`;
  }
  function refresh() {
    if (!x.checkValidity() || !y.checkValidity()) {
      source.textContent = 'Enter whole numbers from 0 to 100.';
      answer.textContent = 'Invalid input';
      answer.className = 'program-answer rejected';
      check.textContent = 'Not checked';
      evaluation.textContent = 'Not evaluated';
      status.textContent = 'Inputs must be bounded natural numbers.';
      return;
    }
    source.textContent = format(expression());
    answer.textContent = 'Ready to type-check';
    answer.className = 'program-answer pending';
    check.textContent = 'Type check';
    evaluation.textContent = 'Evaluate';
    status.textContent = 'Expression changed. Check it before running.';
  }
  function run() {
    if (!x.reportValidity() || !y.reportValidity()) return;
    const raw = expression();
    source.textContent = format(raw);
    const result = Interpreter.run(raw);
    const rejected = result.$ === 'TypeError';
    answer.className = `program-answer ${rejected ? 'rejected' : 'accepted'}`;
    if (rejected) {
      check.textContent = 'Rejected';
      evaluation.textContent = 'Not evaluated';
      answer.textContent = result.message;
      status.textContent = 'Type error. The evaluator never received this program.';
    } else {
      const type = result.$ === 'NumberResult' ? 'Nat' : 'Bool';
      check.textContent = `Expr(${type})`;
      evaluation.textContent = type;
      answer.textContent = `${String(result.value)} : ${type}`;
      status.textContent = 'Type-checked and evaluated in Bend.';
    }
  }
  for (const input of [x, y]) input.addEventListener('input', refresh);
  for (const input of [preset, condition]) input.addEventListener('change', () => { refresh(); run(); });
  document.querySelector('#interpreter-run').addEventListener('click', run);
  run();
}
