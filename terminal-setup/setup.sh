#!/usr/bin/env bash
# Terminal Setup: iTerm2 + tmux (Catppuccin Mocha) + zsh (Powerlevel10k)
#
# One-liner: bash <(curl -fsSL https://jai.one/terminal-setup/setup.sh)
#
# Everything is interactive — prompts before each action.
# Safe to re-run.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
RESET='\033[0m'

step()    { echo -e "\n${GREEN}▸ $1${RESET}"; }
info()    { echo -e "  ${BLUE}$1${RESET}"; }
warn()    { echo -e "  ${YELLOW}$1${RESET}"; }
dim()     { echo -e "  ${DIM}$1${RESET}"; }

confirm() {
    local prompt="$1"
    read -rp "  $prompt [Y/n] " answer
    [[ -z "$answer" || "$answer" =~ ^[Yy] ]]
}

write_file() {
    local dest="$1"
    local description="$2"
    if [[ -f "$dest" ]]; then
        warn "$dest already exists."
        if confirm "Overwrite with new $description?"; then
            return 0
        else
            info "Skipped."
            return 1
        fi
    fi
    return 0
}

# ── 1. Homebrew ──────────────────────────────────────────────────────────────

step "Checking Homebrew"
if ! command -v brew &>/dev/null; then
    info "Homebrew not found."
    if confirm "Install Homebrew?"; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        echo "Homebrew is required. Exiting."
        exit 1
    fi
else
    info "Homebrew already installed."
fi

# ── 2. Core packages ────────────────────────────────────────────────────────

step "Core packages: tmux, fzf, powerlevel10k"

PACKAGES=(tmux fzf powerlevel10k)
MISSING=()
for pkg in "${PACKAGES[@]}"; do
    brew list "$pkg" &>/dev/null || MISSING+=("$pkg")
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    info "Missing: ${MISSING[*]}"
    if confirm "Install ${MISSING[*]}?"; then
        brew install "${MISSING[@]}"
    fi
else
    info "All installed."
fi

# ── 3. iTerm2 ────────────────────────────────────────────────────────────────

step "iTerm2"
if [[ -d "/Applications/iTerm.app" ]]; then
    info "iTerm2 already installed."
else
    if confirm "Install iTerm2 via Homebrew Cask?"; then
        brew install --cask iterm2
    fi
fi

# ── 4. Nerd Font ─────────────────────────────────────────────────────────────

step "Nerd Font (needed for prompt icons + tmux rounded pills)"

if brew list --cask font-meslo-lg-nerd-font &>/dev/null 2>&1; then
    info "MesloLGS Nerd Font already installed."
else
    if confirm "Install MesloLGS Nerd Font?"; then
        brew install --cask font-meslo-lg-nerd-font
        warn "After setup, set iTerm2 font to 'MesloLGS Nerd Font' in Profiles → Text."
    else
        warn "Without a Nerd Font, some glyphs will render as □."
    fi
fi

# ── 5. tmux config ──────────────────────────────────────────────────────────

step "tmux config → ~/.tmux.conf"

if write_file "$HOME/.tmux.conf" "tmux config"; then
cat > "$HOME/.tmux.conf" << 'TMUX_CONF'
set-option -g prefix C-a

# Allow terminal features like clickable file paths (OSC 8) to pass through
set -g allow-passthrough on

# Intuitive splits: | for horizontal, - for vertical
bind-key | split-window -h -c "#{pane_current_path}"
bind-key - split-window -v -c "#{pane_current_path}"

# New windows also inherit pwd
bind-key c new-window -c "#{pane_current_path}"

# Fuzzy-search windows/panes (titles + content)
bind-key f display-popup -E -w 80% -h 80% "$HOME/bin/tmux-search"

# Enable mouse support (click to focus panes)
set -g mouse on

# Keep terminal content visible (needed for neovim)
set-option -g alternate-screen off

# Enable vi mode for better copy/paste
set-window-option -g mode-keys vi

# Improved search and copy bindings
bind-key / copy-mode\; send-key ?
bind-key -T copy-mode-vi y \
  send-key -X start-of-line\; \
  send-key -X begin-selection\; \
  send-key -X end-of-line\; \
  send-key -X cursor-left\; \
  send-key -X copy-selection-and-cancel\; \
  paste-buffer

# Longer scrollback buffer
set -g history-limit 50000

# ── Catppuccin Mocha-inspired theme with rounded pills ───────────────────────
set -g status on
set -g status-position bottom
set -g status-interval 1

set -g status-style 'bg=colour234 fg=colour189'

# Left: session name in a green rounded pill
set -g status-left '#[fg=colour150,bg=colour234]#[bg=colour150,fg=colour234,bold] #S #[fg=colour150,bg=colour234] '
set -g status-left-length 30

# Right: system stats + hostname + time
set -g status-right '#[fg=colour238,bg=colour234]#[bg=colour238,fg=colour240] #(tmux-sysmon net) #[fg=colour236,bg=colour238]#[bg=colour236,fg=colour111] #(tmux-sysmon cpu) #[fg=colour255,bg=colour236]#(tmux-sysmon ram) #[fg=colour236,bg=colour238]#[bg=colour236,fg=colour240]  #h #[fg=colour141,bg=colour236]#[bg=colour141,fg=colour234,bold]   %H:%M #[fg=colour141,bg=colour234]'
set -g status-right-length 100

# Inactive window tabs — muted rounded pills
setw -g window-status-style 'bg=colour234 fg=colour240'
setw -g window-status-format '#[fg=colour236,bg=colour234]#[bg=colour236,fg=colour240] #I #W #[fg=colour236,bg=colour234]'

# Active window tab — lavender rounded pill
setw -g window-status-current-style 'bg=colour234 fg=colour141 bold'
setw -g window-status-current-format '#[fg=colour141,bg=colour234]#[bg=colour141,fg=colour234,bold] #I #W #[fg=colour141,bg=colour234]'

setw -g window-status-separator ''

# Pane borders
set -g pane-border-style 'fg=colour236'
set -g pane-active-border-style 'fg=colour141'
set -g pane-border-status top
set -g pane-border-format '#{?pane_active,#[fg=colour141] ▸ ,#[fg=colour236]   }#T '

# Copy to system clipboard — OS-aware
if-shell 'uname | grep -q Darwin' \
  'bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"' \
  'bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "xclip -selection clipboard"'
TMUX_CONF
    info "Written."
fi

# ── 6. tmux helper scripts ──────────────────────────────────────────────────

step "tmux helper scripts → ~/bin/"

mkdir -p "$HOME/bin"

# ── tmux-search ──
if write_file "$HOME/bin/tmux-search" "fuzzy pane search script"; then
cat > "$HOME/bin/tmux-search" << 'TMUX_SEARCH'
#!/usr/bin/env bash
# Fuzzy-search tmux windows/panes by title (default) or scrollback content (Ctrl-/).
# Invoked via tmux popup: C-a f

SCROLLBACK_LINES=500
TMPFILE="${TMPDIR:-/tmp}/tmux-search-$$"
trap 'rm -f "$TMPFILE"' EXIT

list_titles() {
  tmux list-panes -s -F '#{session_name}:#{window_index}.#{pane_index} #{window_name} #{pane_current_path}'
}

selected=$(
  list_titles | fzf -i \
    --header '  titles  ·  ctrl-/ → content' \
    --with-nth=2.. \
    --preview 'tmux capture-pane -p -S -20 -t {1} 2>/dev/null' \
    --preview-window 'right:45%:wrap' \
    --bind "ctrl-/:reload($(cat <<'RELOAD'
      bash -c '
        SCROLLBACK_LINES=500
        TMPFILE="${TMPDIR:-/tmp}/tmux-search-$$"
        tmux list-panes -s -F "#{session_name}:#{window_index}.#{pane_index} #{window_name}" |
        while IFS=" " read -r target name; do
          tmux capture-pane -p -S "-${SCROLLBACK_LINES}" -t "$target" 2>/dev/null |
          while IFS= read -r line; do
            [ -n "$line" ] && printf "%s [%s] %s\n" "$target" "$name" "$line"
          done
        done | tee "$TMPFILE"
      '
RELOAD
    ))+change-header(  content (exact)  ·  ctrl-/ to refresh)+transform-query(echo {q} | sed \"s/^'\\{0,1\\}/'/\")" \
    --bind 'enter:accept'
)

[ -z "$selected" ] && exit 0

target=$(echo "$selected" | awk '{print $1}')
tmux select-window -t "$target" 2>/dev/null
tmux select-pane -t "$target" 2>/dev/null
TMUX_SEARCH
    chmod +x "$HOME/bin/tmux-search"
    info "Installed ~/bin/tmux-search"
fi

# ── tmux-sysmon ──
if write_file "$HOME/bin/tmux-sysmon" "system monitor script"; then
cat > "$HOME/bin/tmux-sysmon" << 'TMUX_SYSMON'
#!/usr/bin/env bash
# Compact system stats for tmux status bar (Linux + macOS)
# Usage: tmux-sysmon [cpu|ram|net]

OS=$(uname)
CPU_CACHE=/tmp/tmux-sysmon-cpu-prev
NET_CACHE=/tmp/tmux-sysmon-net-prev

read_cpu() {
    local bars=(▁ ▂ ▃ ▄ ▅ ▆ ▇ █)

    if [[ $OS == "Darwin" ]]; then
        local cores
        cores=$(sysctl -n hw.ncpu)
        local usage
        usage=$(ps -A -o %cpu | awk '{s+=$1} END {printf "%.0f", s}')
        local per_core=$(( usage / cores ))

        for (( c=0; c<cores; c++ )); do
            local pct=$per_core
            (( pct > 100 )) && pct=100
            local idx=$(( pct * 7 / 100 ))
            (( idx > 7 )) && idx=7
            local clr
            if   (( pct >= 90 )); then clr='colour111'
            elif (( pct >= 50 )); then clr='colour245'
            else                       clr='colour240'
            fi
            printf '#[fg=%s]%s' "$clr" "${bars[$idx]}"
        done
    else
        declare -A cur_idle cur_total
        while read -r line; do
            [[ $line =~ ^cpu([0-9]+) ]] || continue
            local core=${BASH_REMATCH[1]}
            read -ra fields <<< "$line"
            local idle=${fields[4]}; local total=0
            for f in "${fields[@]:1}"; do (( total += f )); done
            cur_idle[$core]=$idle; cur_total[$core]=$total
        done < /proc/stat

        local have_prev=0; declare -A prev_idle prev_total
        if [[ -f $CPU_CACHE ]]; then
            have_prev=1
            while IFS=' ' read -r core idle total; do
                prev_idle[$core]=$idle; prev_total[$core]=$total
            done < "$CPU_CACHE"
        fi
        for core in "${!cur_idle[@]}"; do
            echo "$core ${cur_idle[$core]} ${cur_total[$core]}"
        done > "$CPU_CACHE"

        local cores=$(nproc)
        for (( c=0; c<cores; c++ )); do
            local pct=0
            if (( have_prev )) && [[ -n ${prev_total[$c]} ]]; then
                local dt=$(( cur_total[$c] - prev_total[$c] ))
                local di=$(( cur_idle[$c] - prev_idle[$c] ))
                (( dt > 0 )) && pct=$(( (dt - di) * 100 / dt ))
            fi
            local idx=$(( pct * 7 / 100 )); (( idx > 7 )) && idx=7
            local clr
            if   (( pct >= 90 )); then clr='colour111'
            elif (( pct >= 50 )); then clr='colour245'
            else                       clr='colour240'
            fi
            printf '#[fg=%s]%s' "$clr" "${bars[$idx]}"
        done
    fi
}

read_ram() {
    if [[ $OS == "Darwin" ]]; then
        local page_size; page_size=$(sysctl -n hw.pagesize)
        local total_bytes; total_bytes=$(sysctl -n hw.memsize)
        local stats; stats=$(vm_stat)
        local active=$(echo "$stats" | awk '/Pages active/ {gsub(/\./,"",$3); print $3}')
        local wired=$(echo "$stats" | awk '/Pages wired/ {gsub(/\./,"",$4); print $4}')
        local compressed=$(echo "$stats" | awk '/Pages occupied by compressor/ {gsub(/\./,"",$5); print $5}')
        local used_bytes=$(( (active + wired + compressed) * page_size ))
        local total_kb=$(( total_bytes / 1024 ))
        local avail_kb=$(( (total_bytes - used_bytes) / 1024 ))
    else
        local total_kb avail_kb
        read -r total_kb avail_kb <<< "$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{print t, a}' /proc/meminfo)"
    fi

    local used_kb=$(( total_kb - avail_kb ))
    local block_kb=$(( 4 * 1048576 ))
    local total_blocks=$(( (total_kb + block_kb - 1) / block_kb ))
    local full=$(( used_kb / block_kb ))
    local frac_num=$(( (used_kb - full * block_kb) * 1000 / block_kb ))
    local used_gb=$(( (used_kb + 1048576/2) / 1048576 ))
    local label="${used_gb}G"; local label_len=${#label}
    local has_partial=0; [[ $full -lt $total_blocks ]] && has_partial=1
    local empty=$(( total_blocks - full - has_partial ))
    local partial=" "
    if (( has_partial )); then
        if   (( frac_num < 125 )); then partial=" "
        elif (( frac_num < 375 )); then partial="▃"
        elif (( frac_num < 625 )); then partial="▄"
        elif (( frac_num < 875 )); then partial="▆"
        else                            partial="█"; fi
    fi
    local pre_blocks=$(( full - label_len )); (( pre_blocks < 0 )) && pre_blocks=0
    local label_over_fill=$(( label_len < full ? label_len : full ))
    local label_over_rest=$(( label_len - label_over_fill ))
    local fill_pre="" label_fill="" label_empty="" fill_post="" empty_str=""
    for (( i=0; i<pre_blocks; i++ )); do fill_pre+='█'; done
    (( label_over_fill > 0 )) && label_fill="${label:0:$label_over_fill}"
    (( label_over_rest > 0 )) && label_empty="${label:$label_over_fill:$label_over_rest}"
    (( has_partial )) && fill_post="$partial"
    local used_empty=$(( empty - (label_over_rest > 0 ? label_over_rest : 0) ))
    (( used_empty < 0 )) && used_empty=0
    for (( i=0; i<used_empty; i++ )); do empty_str+=' '; done
    printf '#[bg=colour238,fg=colour255]%s' "$fill_pre"
    printf '#[bg=colour255,fg=colour234,bold]%s' "$label_fill"
    printf '#[bg=colour238,fg=colour255,bold]%s' "$label_empty"
    printf '#[bg=colour238,fg=colour255,nobold]%s%s' "$fill_post" "$empty_str"
}

read_net() {
    if [[ $OS == "Darwin" ]]; then
        local stats; stats=$(netstat -ib | awk '/^en0/ && $4 ~ /\./ {print $7, $10; exit}')
        local cur_rx=$(echo "$stats" | awk '{print $1}')
        local cur_tx=$(echo "$stats" | awk '{print $2}')
        local cur_time=$(date +%s)
        if [[ -z "$cur_rx" || -z "$cur_tx" ]]; then
            printf '#[fg=colour240]↓   0B ↑   0B'; return
        fi
    else
        local iface; iface=$(ip route show default 2>/dev/null | awk '{print $5; exit}')
        [[ -z $iface ]] && { printf '—'; return; }
        local cur_rx cur_tx cur_time
        read -r cur_rx < "/sys/class/net/$iface/statistics/rx_bytes"
        read -r cur_tx < "/sys/class/net/$iface/statistics/tx_bytes"
        cur_time=$(date +%s%N)
    fi

    if [[ -f $NET_CACHE ]]; then
        local prev_rx prev_tx prev_time; read -r prev_rx prev_tx prev_time < "$NET_CACHE"
        if [[ $OS == "Darwin" ]]; then
            local dt=$(( cur_time - prev_time ))
            if (( dt > 0 )); then local rx_bps=$(( (cur_rx - prev_rx) / dt )); local tx_bps=$(( (cur_tx - prev_tx) / dt ))
            else local rx_bps=0 tx_bps=0; fi
        else
            local dt_ns=$(( cur_time - prev_time ))
            if (( dt_ns > 0 )); then local rx_bps=$(( (cur_rx - prev_rx) * 1000000000 / dt_ns )); local tx_bps=$(( (cur_tx - prev_tx) * 1000000000 / dt_ns ))
            else local rx_bps=0 tx_bps=0; fi
        fi
    else local rx_bps=0 tx_bps=0; fi
    echo "$cur_rx $cur_tx $cur_time" > "$NET_CACHE"

    fmt() {
        local b=$1 s
        if (( b >= 1073741824 )); then s=$(awk "BEGIN {printf \"%.0fG\", $b/1073741824}")
        elif (( b >= 1048576 )); then s=$(awk "BEGIN {printf \"%.0fM\", $b/1048576}")
        elif (( b >= 1024 )); then s=$(awk "BEGIN {printf \"%.0fK\", $b/1024}")
        else s="${b}B"; fi
        printf '%4s' "$s"
    }
    color_for() {
        local b=$1
        if   (( b >= 10485760 )); then printf 'colour196,bold'
        elif (( b >= 1048576  )); then printf 'colour216'
        elif (( b >= 512000   )); then printf 'colour250'
        elif (( b >= 102400   )); then printf 'colour246'
        elif (( b >= 10240    )); then printf 'colour244'
        elif (( b >= 1024     )); then printf 'colour242'
        else                           printf 'colour240'; fi
    }
    local rx_c=$(color_for $rx_bps); local tx_c=$(color_for $tx_bps)
    printf '#[fg=%s]↓%s#[nobold] #[fg=%s]↑%s#[nobold]' "$rx_c" "$(fmt $rx_bps)" "$tx_c" "$(fmt $tx_bps)"
}

case "$1" in cpu) read_cpu;; ram) read_ram;; net) read_net;; esac
TMUX_SYSMON
    chmod +x "$HOME/bin/tmux-sysmon"
    info "Installed ~/bin/tmux-sysmon"
fi

# Make sure ~/bin is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/bin"; then
    warn "~/bin is not in your PATH."
    info "Add to ~/.zshrc:  PATH=\$PATH:~/bin"
fi

# ── 7. Zsh + Powerlevel10k ──────────────────────────────────────────────────

step "Zsh configuration"

if ! grep -q 'powerlevel10k.zsh-theme' "$HOME/.zshrc" 2>/dev/null; then
    if confirm "Add Powerlevel10k + fzf to ~/.zshrc?"; then
        cat >> "$HOME/.zshrc" << 'ZSHRC'

# ── Terminal setup ───────────────────────────────────────────────────────────
source /opt/homebrew/share/powerlevel10k/powerlevel10k.zsh-theme
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
source <(fzf --zsh)
PATH=$PATH:~/bin
ZSHRC
        info "Added to ~/.zshrc"
        info "Run 'p10k configure' on first launch to pick your prompt style."
    fi
else
    info "Powerlevel10k already in .zshrc"
fi

# iTerm2 shell integration
if ! grep -q 'iterm2_shell_integration' "$HOME/.zshrc" 2>/dev/null; then
    if confirm "Install iTerm2 shell integration?"; then
        curl -fsSL https://iterm2.com/shell_integration/zsh -o "$HOME/.iterm2_shell_integration.zsh"
        echo 'test -e "${HOME}/.iterm2_shell_integration.zsh" && source "${HOME}/.iterm2_shell_integration.zsh"' >> "$HOME/.zshrc"
        info "Installed."
    fi
fi

# ── 8. iTerm2 Quake Mode (manual) ───────────────────────────────────────────

step "iTerm2 Quake Mode (manual steps)"

cat << 'INSTRUCTIONS'

  This is the key feature — a system-wide hotkey drops a terminal
  down from the top of the screen.

  1. Open iTerm2 → Preferences (Cmd+,) → Profiles
  2. Create a new profile (e.g. "Dropdown")
  3. Keys tab → "A hotkey opens a dedicated window with this profile"
     → Check box → Configure Hotkey Window
     → Pick hotkey (e.g. backtick `, or Ctrl+`)
     → Check "Floating window"
     → Check "Animate showing and hiding"
  4. Window tab:
     → Style: "Full-Width Top of Screen"
     → Rows: ~35-40
     → Transparency: ~15-20% (optional)
     → Blur: check (optional)
  5. Text tab:
     → Font: "MesloLGS Nerd Font"
  6. Close preferences. Hit your hotkey — terminal drops down.

INSTRUCTIONS

# ── Done ─────────────────────────────────────────────────────────────────────

step "Setup complete!"

cat << 'SUMMARY'

  What's ready:
    + tmux with Catppuccin Mocha theme + rounded pill status bar
    + Fuzzy window search (Ctrl+A then f)
    + System monitor in status bar (CPU sparklines, RAM meter, network)
    + Powerlevel10k prompt (run 'p10k configure' to customize)
    + fzf for fuzzy finding everywhere

  Quick tmux reference:
    Ctrl+A |     Split pane vertically
    Ctrl+A -     Split pane horizontally
    Ctrl+A f     Fuzzy search windows/panes
    Ctrl+A /     Search scrollback
    Ctrl+A c     New window

  Next steps:
    1. Open a new iTerm2 window (or restart terminal)
    2. Run 'tmux' to start a session
    3. Run 'p10k configure' if the prompt looks off
    4. Set up quake mode (see instructions above)

SUMMARY
