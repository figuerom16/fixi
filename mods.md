# mofix
Rolls together q(), qa(), Moxi, Fixi, Paxi, OmegaTable, and Utils.
My custom version of the [Fixi project](https://fixiproject.org/) and some tools; made for the target audience of myself. Copy out what you like since this library gets modified constantly. The goal is to make a library that works specifically for me. Be sure to check out the original Fixi project for the original/core code.

## q(selector, context = document), qa(selector, context = document)

> [!IMPORTANT] Remember! `q` returns one element or null. `qa` returns an array of elements; an unmatched selector returns an empty array.

The query helpers in `myfixi.js <first ~40 lines of code>` provide compact relative/traversal CSS-selector through `q` and `qa`.

q will scopes to document unless another context is supplied. Selectors can be chained with `->`. Each segment feeds the context to the next segment:

```js
q('.list -> first child -> next sibling -> next sibling')
```

- `q('button', this)` can return a single button element or null.
- `qa('button', this)` can return an array of button elements or empty array.
- With no explicit context, `q()` and `qa()` choose the first available context in this order: `doc.currentScript`, an element-bound `this`, `globalThis.event?.target`, then `document`.
- `q()` with no selector returns its resolved context. `qa()` with no selector returns that context in a one-element array.
- An explicit falsy context also falls back through the same context-resolution order.
- `doc` is the document reference used by the implementation. document-level queries should use `q(selector, doc)` or `qa(selector, doc)` when another context would otherwise be inferred.

For example, code running directly inside a `<script>` uses that script as its implicit context:

```html
<script>
	q('.button')?.classList.add('ready')
	q('#global-button', doc)?.classList.add('ready')
</script>
```

- `doc` is provided as an alias for `document`.
- `.ael` is provided as an alias for `.addEventListener`.

### Supported traversal commands

The command syntax is:

```text
command <selector|shortcut>
```

| Command | Behavior |
| --- | --- |
| `closest sel:par` | Finds the closest matching ancestor of the current element. |
| `first sel:chi` | Finds the first matching descendant. |
| `last sel:chi` | Finds the last matching descendant. |
| `next sel:sib` | Finds the next matching element in document order. |
| `prev sel:sib` | Finds the previous matching element in document order. `prev sibling` returns the previous element sibling. |

> **Note:** The special `parent`, `child`, and `sibling` shortcuts only require their first three characters: `par`, `chi`, and `sib`. For example, `closest par`, `first chi`, `next sib` use the same special behavior.

For chained selectors, `qa` resolves the portion before the final `->` with `q` which always resolves to one element then returns all matches for the final segment. If the final segment is a traversal command, the result is an array with one element or [].
`q` returns one element.

### Practical examples

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

## ALL

- Some minor formatting
- replaced all QuerySelector and QuerySelectorAll with `q()` and `qa()`

## Moxi Mods

- Removed `q()` and its proxy functionality. `q()` and `qa()` are now it's own standalone functions.
- Added in proposed Github PRs #1 and #2.

## Fixi Mods

- Added in ael helper
- Only use formData on element when element is form
- When when element is tr collect td name and value into formData
- When element is named and has files or values add the data to formData.
- When element is input of type file or image make data a multipart form.
- Remove extra headers and configurations.
- Use q() for target.
- Add in LOCAL Method for calling in client JS function and swapping in HTML.
- fx-trigger now supports multiple triggers fx-trigger="click|mouseout|mouseover"
- Directly add in Toast, Error/Success & Redirect/Refresh, and Lucide Icon Creation.

## Paxi Mods

- None

## OmegaTable

Add dynamic functionality to standard tables with editing, sorting, searching, and saving capabilities.

- getArrows() - Helper: User defined sorting arrows for Table Header
- getHeaders() - Helper: returns table Headers
- tr(tr) - Init: Uses defined td values to set inner td controls
- tbody(tbody) - Init: Creates table listeners for input|click|keydown to handle loading td values | highlighting and selecting cells | table navigation and copying behavior
- thead(thead) - The column sorter listener that will order columns based on arrow position.
- search(table, column='', term='') - Table search that sets unamatched rows to hide and returns result count.
- save(table,sep='|',filename='output.csv') - Save visible table csv.
- NOTE: Highlighting selected cells is done through CSS (not here).

## Util

Just some helper functions for myself.

- generateKey() - creates 32 character Base64URL ID
- durationtoNanos - convert Golang duration string to nanoseconds.

## LICENCE

```
Zero-Clause BSD
=============

Permission to use, copy, modify, and/or distribute this software for
any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY
DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN
AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT
OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
