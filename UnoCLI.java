import java.util.*;

public class UnoCLI {
    class Galaxy {
        private String name;
        private String description;
        private String type;
        private int diameter;
        private double age;
        private double distanceFromEarth;
        private Map<String, Planet> planets;

        public Galaxy(String name, String description, String type, int diameter, double age, double distanceFromEarth) {
            this.name = name;
            this.description = description;
            this.type = type;
            this.diameter = diameter;
            this.age = age;
            this.distanceFromEarth = distanceFromEarth;
            this.planets = new HashMap<>();
        }

        public void addPlanet(Planet planet) {
            planets.put(planet.getName().toLowerCase(), planet);
        }

        // Getters
        public String getName() { return name; }
        public String getDescription() { return description; }
        public String getType() { return type; }
        public int getDiameter() { return diameter; }
        public double getAge() { return age; }
        public double getDistanceFromEarth() { return distanceFromEarth; }
        public Map<String, Planet> getPlanets() { return planets; }
    }

    // Enhanced Planet class
    class Planet {
        private String name;
        private int minTemp;
        private int maxTemp;
        private String state;
        private String description;
        private double gravity;
        private double orbitalPeriod;
        private boolean hasAtmosphere;
        private int diameter;
        private String type;

        public Planet(String name, int minTemp, int maxTemp, String state, String description,
                      double gravity, double orbitalPeriod, boolean hasAtmosphere, int diameter, String type) {
            this.name = name;
            this.minTemp = minTemp;
            this.maxTemp = maxTemp;
            this.state = state;
            this.description = description;
            this.gravity = gravity;
            this.orbitalPeriod = orbitalPeriod;
            this.hasAtmosphere = hasAtmosphere;
            this.diameter = diameter;
            this.type = type;
        }

        // Getters
        public String getName() { return name; }
        public int getMinTemp() { return minTemp; }
        public int getMaxTemp() { return maxTemp; }
        public String getState() { return state; }
        public String getDescription() { return description; }
        public double getGravity() { return gravity; }
        public double getOrbitalPeriod() { return orbitalPeriod; }
        public boolean hasAtmosphere() { return hasAtmosphere; }
        public int getDiameter() { return diameter; }
        public String getType() { return type; }
    }





    private static final Map<String, Galaxy> UNIVERSE = new HashMap<>();
    private static String currentGalaxy = "";
    private static String currentPlanet = "";
    private static final Scanner scanner = new Scanner(System.in);
    private static final Map<String, String> discoveredFacts = new HashMap<>();
    private static int knowledgePoints = 0;
    private static final List<String> explorationLog = new ArrayList<>();


    private static void printPrompt() {
        StringBuilder prompt = new StringBuilder(" ");
        if (currentGalaxy.isEmpty()) {
            prompt.append("Universe");
        } else {
            Galaxy galaxy = UNIVERSE.get(currentGalaxy);
            prompt.append(" ").append(galaxy.getName());
            if (!currentPlanet.isEmpty()) {
                Planet planet = galaxy.getPlanets().get(currentPlanet);
                prompt.append("/").append(planet.getName());
            }
        }
        prompt.append(" [").append(knowledgePoints).append("] $ ");
        System.out.print(prompt.toString());
    }

    public static void main(String[] args) {
        printPrompt();
    }
}
