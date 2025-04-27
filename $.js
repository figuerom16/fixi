function $(s) { // s=selector, el=element, els=elements
	let el, els
	const start = document.currentScript // Doesn't work in callback use Event or QuerySelector
	if (!s) el = start.parentElement ?? console.warn('$(): Fails inside callback.')
	else if (s instanceof Event) el = s.currentTarget ?? console.warn('$: Event is Null')
	else if (typeof s !== 'string') {console.warn('$: Not a String'); return null}
	else if (s == '-') el = start.previousElementSibling ?? console.warn('$(\'-\'): Fails inside callback.')
	else if (s.indexOf('closest ') == 0) el = start.closest(s.substring(8))
	else if (s.indexOf('next ') == 0){
		const matches = Array.from(document.querySelectorAll(s.substring(5)))
		el = matches.find((el)=>start.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING)
	}
	else if (s.indexOf('previous ') == 0){
		const matches = Array.from(document.querySelectorAll(s.substring(9))).reverse()
		el = matches.find((el)=>start.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_PRECEDING)
	}
	if (el) els = [el]
	else {
		els = Array.from(document.querySelectorAll(s))
		if (els.length === 0) {console.warn("$: QuerySelector is Null"); return null}
	}
	return { // e=event, c=callback
		$: els[0],
		all: els,
		nav: (nav)=>{
			el = els[0]
			for (const n of nav.split(' ')) {
				switch (n) {
					case 'parent': el = el.parentElement; break
					case 'next': el = el.nextElementSibling; break
					case 'previous': el = el.previousElementSibling; break
					case 'first': el = el.firstElementChild; break
					case 'last': el = el.lastElementChild; break
					default: console.warn(`$: Nav ${n} is not Valid`)
				}
			}
			return el
		},
		// Add more returns here
		on: (e, c)=>(els.forEach(el => el.addEventListener(e, c)), this),
		off: (e, c)=>(els.forEach(el => el.removeEventListener(e, c)), this),
		run: (c)=>(els.forEach(_=>f(c)), this),
		send: (name, detail, bubbles = true)=>(els.forEach(el => el.dispatchEvent(new CustomEvent(name, { detail, bubbles }))), this),
		// Add more chainables here
	}
}

function signal(init) {
	let value = init
	const subs = new Set()
	const sig = _=>{ return value }
	sig.set = newValue=>{
		if (newValue !== value) {
			value = newValue
			subs.forEach(sub => sub(value))
		}
	}
	sig.sub = cb=>{
		subs.add(cb)
		return _=>subs.delete(cb)
	}
	sig.pop = _=>{
		if (subs.size == 0) return
		let last
		for (const sub of subs) last = sub
		subs.delete(last)
	}
	return sig
}
