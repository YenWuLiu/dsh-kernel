/** Direct window_list diagnostic: koffi EnumWindows from the verify dir. */
import koffi from 'koffi'

const user32 = koffi.load('user32.dll')
const EnumWindows = user32.func('bool EnumWindows(void *lpEnumFunc, intptr lparam)')
const IsWindowVisible = user32.func('bool IsWindowVisible(void *hWnd)')
const GetWindowTextW = user32.func('int GetWindowTextW(void *hWnd, void *lpString, int nMaxCount)')
const GetWindowTextLengthW = user32.func('int GetWindowTextLengthW(void *hWnd)')

const out = []
const cb = koffi.register((hwnd) => {
  if (IsWindowVisible(hwnd)) {
    const len = GetWindowTextLengthW(hwnd)
    if (len > 0) {
      const buf = Buffer.alloc((len + 1) * 2)
      GetWindowTextW(hwnd, buf, len + 1)
      const title = buf.toString('utf16le').replace(/\0+$/, '')
      if (title.trim() !== '') out.push(title)
    }
  }
  return true
}, 'bool (*)(void *, intptr)')
try {
  EnumWindows(cb, 0)
} finally {
  koffi.unregister(cb)
}
console.log(`windows: ${out.length}`)
console.log(out.slice(0, 8).map((t) => ` - ${t}`).join('\n'))
