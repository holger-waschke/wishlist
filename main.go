package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type Reservations map[string]string

type Wish struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Price       string `json:"price,omitempty"`
	Owner       string `json:"owner"`
	Image       string `json:"image,omitempty"`
	Description string `json:"description,omitempty"`
}

var (
	dataFile        = "/data/reservations.json"
	wishesFile      = "/data/wishes.private.json"
	mu              sync.Mutex
	wishesMu        sync.Mutex
	errWishNotFound = errors.New("wish not found")
)

func main() {
	fs := http.FileServer(http.Dir("."))
	http.Handle("/api/admin/wishes", logRequests(http.HandlerFunc(adminWishesHandler)))
	http.Handle("/api/admin/wishes/", logRequests(http.HandlerFunc(adminWishesHandler)))
	http.Handle("/api/reservation", logRequests(http.HandlerFunc(reservationHandler)))
	http.Handle("/api/wishes", logRequests(http.HandlerFunc(wishesHandler)))
	http.Handle("/api/wishes/", logRequests(http.HandlerFunc(wishesHandler)))
	http.Handle("/", logRequests(fs))

	log.Println("Serving on :5000")
	log.Fatal(http.ListenAndServe(":5000", nil))
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s", r.RemoteAddr, r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func wishesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	wishes, err := readWishes()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(wishes)
}

func adminWishesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		wishes, err := readWishes()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(wishes)
	case http.MethodPost:
		defer r.Body.Close()

		var wish Wish
		if err := json.NewDecoder(r.Body).Decode(&wish); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}

		sanitizeWish(&wish)
		if err := validateWish(wish); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if wish.ID == "" {
			wish.ID = generateWishID(wish.Owner, wish.Title)
		}

		if err := appendWish(wish); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(wish)
	case http.MethodPut:
		handleWishUpdate(w, r, "/api/admin/wishes/")
	case http.MethodDelete:
		handleWishDelete(w, r, "/api/admin/wishes/")
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleWishDelete(w http.ResponseWriter, r *http.Request, prefix string) {
	id, err := extractWishID(r.URL.Path, prefix)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := deleteWish(id); err != nil {
		if errors.Is(err, errWishNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func deleteWish(id string) error {
	wishesMu.Lock()
	defer wishesMu.Unlock()

	wishes, err := loadWishes()
	if err != nil {
		return err
	}

	index := -1
	for i := range wishes {
		if wishes[i].ID == id {
			index = i
			break
		}
	}

	if index == -1 {
		return errWishNotFound
	}

	wishes = append(wishes[:index], wishes[index+1:]...)
	return writeWishes(wishes)
}

func handleWishUpdate(w http.ResponseWriter, r *http.Request, prefix string) {
	id, err := extractWishID(r.URL.Path, prefix)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	defer r.Body.Close()

	var wish Wish
	if err := json.NewDecoder(r.Body).Decode(&wish); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}

	wish.ID = id
	sanitizeWish(&wish)
	if err := validateWish(wish); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updated, err := updateWish(wish)
	if err != nil {
		if errors.Is(err, errWishNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

func extractWishID(path, prefix string) (string, error) {
	if !strings.HasPrefix(path, prefix) {
		return "", fmt.Errorf("wish id missing")
	}

	id := strings.TrimPrefix(path, prefix)
	if id == "" || strings.Contains(id, "/") {
		return "", fmt.Errorf("invalid wish id")
	}

	return id, nil
}

func updateWish(wish Wish) (Wish, error) {
	wishesMu.Lock()
	defer wishesMu.Unlock()

	wishes, err := loadWishes()
	if err != nil {
		return Wish{}, err
	}

	replaced := false
	for i := range wishes {
		if wishes[i].ID == wish.ID {
			wishes[i] = wish
			replaced = true
			break
		}
	}

	if !replaced {
		return Wish{}, errWishNotFound
	}

	if err := writeWishes(wishes); err != nil {
		return Wish{}, err
	}

	return wish, nil
}

func readWishes() ([]Wish, error) {
	wishesMu.Lock()
	defer wishesMu.Unlock()
	return loadWishes()
}

func appendWish(wish Wish) error {
	wishesMu.Lock()
	defer wishesMu.Unlock()

	wishes, err := loadWishes()
	if err != nil {
		return err
	}
	wishes = append(wishes, wish)
	return writeWishes(wishes)
}

func loadWishes() ([]Wish, error) {
	data, err := os.ReadFile(wishesFile)
	if err != nil {
		if os.IsNotExist(err) {
			return []Wish{}, nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return []Wish{}, nil
	}

	var wishes []Wish
	if err := json.Unmarshal(data, &wishes); err != nil {
		return nil, err
	}
	return wishes, nil
}

func writeWishes(wishes []Wish) error {
	data, err := json.MarshalIndent(wishes, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(wishesFile, data, 0o644)
}

func sanitizeWish(wish *Wish) {
	wish.Title = strings.TrimSpace(wish.Title)
	wish.URL = strings.TrimSpace(wish.URL)
	wish.Price = strings.TrimSpace(wish.Price)
	wish.Owner = strings.TrimSpace(strings.ToLower(wish.Owner))
	wish.Image = strings.TrimSpace(wish.Image)
	wish.Description = strings.TrimSpace(wish.Description)
}

func validateWish(wish Wish) error {
	if wish.Title == "" {
		return fmt.Errorf("title is required")
	}
	if wish.URL == "" {
		return fmt.Errorf("url is required")
	}
	if wish.Owner == "" {
		return fmt.Errorf("owner is required")
	}
	return nil
}

func generateWishID(owner, title string) string {
	base := strings.ReplaceAll(strings.TrimSpace(owner+"-"+title), " ", "-")
	if base == "" || base == "-" {
		base = "wish"
	}
	return fmt.Sprintf("%s-%d", strings.ToLower(base), time.Now().UnixNano())
}

func reservationHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		state, err := readReservations()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(state)
	case http.MethodPost:
		defer r.Body.Close()

		var payload Reservations
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}
		if err := writeReservations(payload); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(payload)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func readReservations() (Reservations, error) {
	mu.Lock()
	defer mu.Unlock()

	data, err := os.ReadFile(dataFile)
	if err != nil {
		if os.IsNotExist(err) {
			return make(Reservations), nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return make(Reservations), nil
	}

	var res Reservations
	if err := json.Unmarshal(data, &res); err != nil {
		return nil, err
	}
	return res, nil
}

func writeReservations(res Reservations) error {
	mu.Lock()
	defer mu.Unlock()

	data, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dataFile, data, 0o644)
}
