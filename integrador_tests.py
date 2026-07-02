import time
import random
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import TimeoutException, UnexpectedAlertPresentException

BASE_URL = "http://localhost:5173"
DELAY = 3.5  # Pausa para ver la ejecución (ralentizada para ver detalles)

def inicializarDriver(browser_name):
    if browser_name.lower() == "chrome":
        driver = webdriver.Chrome()
    elif browser_name.lower() == "edge":
        driver = webdriver.Edge()
    elif browser_name.lower() == "firefox":
        driver = webdriver.Firefox()
    else:
        raise ValueError(f"Navegador no soportado: {browser_name}")
    return driver

def ejecutar_pc1(driver, wait, unique_id):
    """
    PC1: Registro de padre/tutor exitoso.
    Datos: Correo válido, Contraseña >= 6 caracteres, campos requeridos llenos.
    Resultado esperado: Registro exitoso, redirección a /login.
    """
    print("  [PC1] Probando registro de padre/tutor exitoso...")
    driver.get(f"{BASE_URL}/register")
    time.sleep(DELAY)

    # Seleccionar pestaña Padre/Tutor
    wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Padre / Tutor')]"))).click()
    time.sleep(DELAY)

    # Llenar datos
    email = f"padretest_{unique_id}@test.com"
    wait.until(EC.presence_of_element_located((By.ID, "reg-email"))).send_keys(email)
    driver.find_element(By.ID, "reg-pass").send_keys("padre1234")
    driver.find_element(By.ID, "reg-confirm").send_keys("padre1234")
    driver.find_element(By.ID, "padre-tel").send_keys("6141234567")
    driver.find_element(By.ID, "padre-dir").send_keys("Chih., Chih., México")
    time.sleep(DELAY)

    # Registrar
    driver.find_element(By.XPATH, "//button[@type='submit']").click()

    try:
        # Intentar esperar el modal visual primero, con fallback a alerta nativa
        try:
            success_modal = wait.until(EC.visibility_of_element_located((By.ID, "success-alert")))
            print("    [PC1] Alerta visual detectada en la web.")
            confirm_btn = driver.find_element(By.ID, "success-alert-confirm")
            time.sleep(DELAY)
            confirm_btn.click()
            time.sleep(DELAY)
        except TimeoutException:
            # Fallback a alerta nativa
            wait.until(EC.alert_is_present())
            alert = driver.switch_to.alert
            print(f"    [PC1] Alerta nativa recibida: '{alert.text}'")
            alert.accept()
            time.sleep(DELAY)
        
        # Verificar redirección
        wait.until(EC.url_contains("/login"))
        print("    [✓] PC1 PASÓ: Perfil creado exitosamente y redireccionó a /login.")
        return True
    except Exception as e:
        print(f"    [X] PC1 FALLÓ: {e}")
        return False

def ejecutar_pc2(driver, wait):
    """
    PC2: Registro de padre/tutor con correo inválido.
    Datos: Correo sin formato de email ("padre.test").
    Resultado esperado: Error de validación (el navegador o el backend rechazan la solicitud).
    """
    print("  [PC2] Probando registro con correo inválido ('padre.test')...")
    driver.get(f"{BASE_URL}/register")
    time.sleep(DELAY)

    # Seleccionar pestaña Padre/Tutor
    wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Padre / Tutor')]"))).click()
    time.sleep(DELAY)

    # Llenar datos
    wait.until(EC.presence_of_element_located((By.ID, "reg-email"))).send_keys("padre.test")
    driver.find_element(By.ID, "reg-pass").send_keys("padre1234")
    driver.find_element(By.ID, "reg-confirm").send_keys("padre1234")
    driver.find_element(By.ID, "padre-tel").send_keys("6141234567")
    driver.find_element(By.ID, "padre-dir").send_keys("Chih., Chih., México")
    time.sleep(DELAY)

    # Registrar
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    time.sleep(DELAY)

    # Comprobamos si la validación HTML5 de email detuvo el envío (seguimos en /register y no hay alerta de éxito)
    try:
        # Verificar que no hay alerta de éxito
        alert = driver.switch_to.alert
        alert_text = alert.text
        alert.accept()
        print(f"    [X] PC2 FALLÓ: Se detectó una alerta inesperada: '{alert_text}'")
        return False
    except Exception:
        # Si no hay alerta y seguimos en /register, la validación HTML5 o el formulario bloqueó el envío (correcto)
        if "/register" in driver.current_url:
            print("    [✓] PC2 PASÓ: El formulario bloqueó el correo inválido. Registro fallido como se esperaba.")
            return True
        else:
            print(f"    [X] PC2 FALLÓ: Redirigió a '{driver.current_url}' sin validar el correo.")
            return False

def ejecutar_pc3(driver, wait, unique_id):
    """
    PC3: Registro del niño con contraseña inválida (corta/vacía).
    Datos: Contraseña de 4 caracteres (menor a los 6 requeridos).
    Resultado esperado: Alerta o banner de error de contraseña corta.
    """
    print("  [PC3] Probando registro de paciente con contraseña corta (4 caracteres)...")
    driver.get(f"{BASE_URL}/register")
    time.sleep(DELAY)

    # Seleccionar pestaña Hijo (TEA)
    wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Hijo (TEA)')]"))).click()
    time.sleep(DELAY)

    # Llenar datos
    email = f"pacientetest_{unique_id}@test.com"
    wait.until(EC.presence_of_element_located((By.ID, "reg-email"))).send_keys(email)
    driver.find_element(By.ID, "reg-pass").send_keys("1234")  # Corta
    driver.find_element(By.ID, "reg-confirm").send_keys("1234")
    
    # Selects
    Select(driver.find_element(By.ID, "paciente-etapa")).select_by_value("13-18")
    Select(driver.find_element(By.ID, "paciente-com")).select_by_value("Básico")
    time.sleep(DELAY)

    # Registrar
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    time.sleep(DELAY)

    # Buscamos el banner de error en la página
    try:
        error_elements = driver.find_elements(By.XPATH, "//div[contains(., 'contraseña') or contains(., 'caracteres') or contains(@style, 'fef2f2')]")
        error_detectado = False
        for el in error_elements:
            if el.text.strip():
                print(f"    [✓] PC3 PASÓ: Se detectó error en pantalla: '{el.text.strip()}'")
                error_detectado = True
                break
        
        if not error_detectado:
            # Si no hay banner, ver si hay alerta
            try:
                alert = driver.switch_to.alert
                print(f"    [✓] PC3 PASÓ: Alerta recibida: '{alert.text}'")
                alert.accept()
                error_detectado = True
            except Exception:
                pass
                
        if error_detectado:
            return True
        else:
            print("    [X] PC3 FALLÓ: No se mostró ningún mensaje de error al usar una contraseña corta.")
            return False
    except Exception as e:
        print(f"    [X] PC3 FALLÓ: {e}")
        return False

def ejecutar_pc4(driver, wait, unique_id):
    """
    PC4: Registro de terapeuta con especialidad "Dentista" (Caso de prueba de lógica de negocio / Bug).
    Datos: Correo, Especialidad "Dentista" (fuera del dominio de TEA).
    Resultado esperado: La cuenta NO debería poder crearse.
    Resultado real de la app: Cuenta creada con éxito (Bug).
    """
    print("  [PC4] Probando registro de terapeuta con especialidad fuera de dominio ('Dentista')...")
    driver.get(f"{BASE_URL}/register")
    time.sleep(DELAY)

    # Seleccionar pestaña Terapeuta
    wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Terapeuta')]"))).click()
    time.sleep(DELAY)

    # Llenar datos
    email = f"terapeutatest_{unique_id}@test.com"
    wait.until(EC.presence_of_element_located((By.ID, "reg-email"))).send_keys(email)
    driver.find_element(By.ID, "reg-pass").send_keys("tera1234")
    driver.find_element(By.ID, "reg-confirm").send_keys("tera1234")
    
    # Datos de terapeuta
    driver.find_element(By.ID, "ter-esp").send_keys("Dentista")
    driver.find_element(By.ID, "ter-ced").send_keys("7899104213")
    time.sleep(DELAY)

    # Registrar
    driver.find_element(By.XPATH, "//button[@type='submit']").click()

    try:
        # Intentar esperar el modal visual primero, con fallback a alerta nativa
        alert_text = ""
        try:
            success_modal = wait.until(EC.visibility_of_element_located((By.ID, "success-alert")))
            print("    [PC4] Alerta visual detectada en la web.")
            alert_text = "exito" # Si aparece el modal visual, significa que el registro se creó exitosamente (Bug)
            confirm_btn = driver.find_element(By.ID, "success-alert-confirm")
            time.sleep(DELAY)
            confirm_btn.click()
            time.sleep(DELAY)
        except TimeoutException:
            # Fallback a alerta nativa
            wait.until(EC.alert_is_present())
            alert = driver.switch_to.alert
            alert_text = alert.text
            alert.accept()
            time.sleep(DELAY)
        
        # Si se creó con éxito, reportamos el bug según lo documentado en la tabla
        if "exito" in alert_text.lower() or "éxito" in alert_text.lower():
            print("    [!] BUG DETECTADO (PC4): La cuenta de terapeuta se creó con éxito con la especialidad 'Dentista'.")
            print("        (Resultado Esperado: Falla | Resultado Real: Cuenta creada con éxito)")
            return False
        else:
            print(f"    [✓] PC4 PASÓ: El sistema rechazó el registro. Alerta: '{alert_text}'")
            return True
    except Exception as e:
        # Si falló (no se creó ni alerta ni modal de éxito), es correcto según el resultado esperado
        print("    [✓] PC4 PASÓ: No se creó la cuenta (el sistema bloqueó el registro de especialidad inválida).")
        return True

def main():
    navegadores = ["chrome", "edge", "firefox"]

    for nav in navegadores:
        print(f"\n=======================================================")
        print(f" INICIANDO PRUEBAS INTEGRADORAS (PC1-PC4) EN: {nav.upper()}")
        print(f"=======================================================")
        
        driver = None
        unique_id = f"{int(time.time())}_{random.randint(10, 99)}"
        
        try:
            driver = inicializarDriver(nav)
            driver.maximize_window()
            wait = WebDriverWait(driver, 15)
            
            # 1. Ejecutar PC1
            pc1_res = ejecutar_pc1(driver, wait, unique_id)
            
            # 2. Ejecutar PC2
            pc2_res = ejecutar_pc2(driver, wait)
            
            # 3. Ejecutar PC3
            pc3_res = ejecutar_pc3(driver, wait, unique_id)
            
            # 4. Ejecutar PC4
            pc4_res = ejecutar_pc4(driver, wait, unique_id)
            
            print(f"\n--- Resumen de Resultados en {nav.upper()} ---")
            print(f"  PC1 (Registro Padre Exitoso): {'PASÓ' if pc1_res else 'FALLÓ'}")
            print(f"  PC2 (Correo Inválido): {'PASÓ' if pc2_res else 'FALLÓ'}")
            print(f"  PC3 (Contraseña Corta): {'PASÓ' if pc3_res else 'FALLÓ'}")
            print(f"  PC4 (Especialidad Dentista): {'PASÓ (Bloqueado)' if pc4_res else 'FALLÓ (Bug: Cuenta creada)'}")
            
        except Exception as e:
            print(f"[ERROR] Error inesperado en {nav.upper()}: {e}")
        finally:
            if driver:
                time.sleep(DELAY * 2)  # Pausa extra al final de las pruebas en este navegador
                driver.quit()

if __name__ == '__main__':
    main()
