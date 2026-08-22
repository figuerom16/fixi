# Query helpers

The query helpers in `mofix.js <first 40 lines of code>` provide compact relative/traversal CSS-selector through `q` and `qa`.

## `q(selector, context = document)`

q will scope to document unless another context is supplied.

Returns one element, or `null` when no match is found.

Selectors can be chained with `->`. Each segment feeds the context to the next segment:

```js
q('.list -> first child -> next sibling -> next sibling')
```

SPECIAL LIBRARY CASE: A chain can begin with `doc` manually setting context back to `document` as an escape hatch. This is useful for when q() is used in other libraries where a local context is already set. My fixi implementation has fx-target use `q(s,this)` so `fx-target="#myid"` will only look inside the element it currently is on. To escape the current element target `fx-target="doc -> #myid"`:

### Supported traversal commands

The command syntax is:

```text
command selector
```

| Command | Behavior |
| --- | --- |
| `closest selector` | Finds the closest matching ancestor of the current element. `closest parent` returns its direct parent. |
| `first selector` | Finds the first matching descendant. `first child` returns the first element child. |
| `last selector` | Finds the last matching descendant. `last child` returns the last element child. |
| `next selector` | Finds the next matching element in document order. `next sibling` returns the next element sibling. |
| `prev selector` | Finds the previous matching element in document order. `prev sibling` returns the previous element sibling. |

> **Note:** The special `parent`, `child`, and `sibling` shortcuts only require their first three characters: `par`, `chi`, and `sib`. For example, `closest par` and `next sib` use the same special behavior.

## `qa(selector, context = document)`

Returns an array of all matching elements. If the selector does not match anything, it returns an empty array.

```js
qa('.item')
qa('.item', container)
qa('.list -> .item')
qa('.item -> next .highlight')
```

Because `qa` returns a regular array, its results can be used directly with `forEach`:

```js
qa('.card').forEach(card => {
	card.classList.add('is-ready')
})
```

For chained selectors, `qa` resolves the portion before the final `->` with `q` which resolves the to the first .item, then returns all matches for the final segment. If the final segment is a traversal command, the result is an array with one element or [].

## Practical examples

Use `q` when you want to act on one element, such as toggling a class on the first matching button:

```js
q('.menu-button')?.classList.toggle('is-open')
```

Get the third row of a table with a regular CSS selector:

```js
const thirdRow = q('table tbody -> tr:nth-child(3)')
```

Traversal commands can keep the lookup readable while working from a known element:

```js
q('.card -> closest article')?.classList.toggle('is-selected')
```

Use `qa` when the same action should apply to every match:

```js
qa('.todo-item').forEach(item => {
	q('.checkbox', item)?.classList.toggle('is-checked')
})
// Or grab the list context then checkbox class items
qa('.todo-list -> .checkbox').forEach(item => {
	item.classList.toggle('is-checked')
})
```

## Empty input

- `q()` or `q(selector, null)` returns the current context.
- `qa()` or `qa(selector, null)` returns `[]`.
