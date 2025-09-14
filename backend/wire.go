package backend

// WireEntry is a compact representation of a directory entry for streaming.
// Field names are shortened to reduce MessagePack payload size.
// n: name, d: isDir, s: size, m: modTime (unix seconds), h: isHidden
type WireEntry struct {
	N string `msgpack:"n"`
	D bool   `msgpack:"d"`
	S int64  `msgpack:"s,omitempty"`
	M int64  `msgpack:"m"`
	H bool   `msgpack:"h,omitempty"`
}

func toWireEntries(in []FileInfo) []WireEntry {
	out := make([]WireEntry, 0, len(in))
	for i := range in {
		fi := &in[i]
		we := WireEntry{N: fi.Name, D: fi.IsDir, M: fi.ModTime.Unix()}
		if !fi.IsDir {
			we.S = fi.Size
		}
		if fi.IsHidden {
			we.H = true
		}
		out = append(out, we)
	}
	return out
}
