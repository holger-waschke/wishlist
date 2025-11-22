package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
)

type Reservations map[string]bool

var (
	dataFile = "reservations.json"
	mu       sync.Mutex
)

func main() {
	fs := http.FileServer(http.Dir("."))
	http.Handle("/api/reservation", logRequests(http.HandlerFunc(reservationHandler)))
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
