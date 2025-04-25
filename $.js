function $(s) { // s=selector, el=element, els=elements
	let el, els
	const script = document.currentScript
	if (!s) el = script.parentElement
	else if (s instanceof Event) el = s.currentTarget ?? console.warn("$: Event is Null")
	else if (typeof s !== 'string') {console.warn("$: Not a String"); return null}
	else if (s === '-') el = script.previousElementSibling
	else if (s.indexOf('closest ') == 0) el = script.closest(s.substring(8))
	else if (s.indexOf('next ') == 0){
		const matches = Array.from(document.querySelectorAll(s.substring(5)))
		el = matches.find((el)=>script.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING)
	}
	else if (s.indexOf('previous ') == 0){
		const matches = Array.from(document.querySelectorAll(s.substring(9))).reverse()
		el = matches.find((el)=>script.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_PRECEDING)
	}
	if (el) els = [el]
	else {
		els = Array.from(document.querySelectorAll(s))
		if (els.length === 0) {console.warn("$: QuerySelector is Null"); return null}
	}
	return { // e=event, c=callback
		one: els[0],
		all: els,
		on: (e, c)=>(els.forEach(el => el.addEventListener(e, c)), this),
		off: (e, c)=>(els.forEach(el => el.removeEventListener(e, c)), this),
		disable: _=>(els.forEach(el => el.disabled = true), this),
		enable: _=>(els.forEach(el => el.disabled = false), this),
		send: (name, detail, bubbles = true)=>(els.forEach(el => el.dispatchEvent(new CustomEvent(name, { detail, bubbles }))), this),
		// Add more chainables here
	}
}
