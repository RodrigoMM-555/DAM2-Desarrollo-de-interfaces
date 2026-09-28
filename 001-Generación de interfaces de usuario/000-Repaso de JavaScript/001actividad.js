
/*
Crea un programa de gestión de inscripción de alumnos

Cada alumno tiene los siguientes datos:
	- nombre
	- edad
	- tieneMatricula
	- bloqueado
	- precioCurso
	- descuento
	- nota

Crea una función calcularPrecioFinal()

Crea una función puedeAcceder() que compruebe que el alumno es mayor de edad, está matriculado y no esta bloqueado

Crea una función obtenerCalificacion(). Posibles valores a devolver:
	- Nota no válida
	- Suspenso
	- Aprobado
	- Bien
	- Notable
	- Sobresaliente

Muestra un mensaje con toda la información del alumno que utilice las funciones creadas anteriormente

Ampliación 1: añade un campo "modalidad" a partir del cual se obtenga un descuento extra.
	- Presencial -> Sin descuento
	- Semi-presencial -> 10% de descuento
	- Online -> 20% de descuento

Ampliación 2: Integra este código en un formulario para que los valores de las variables sean extraídos de aquí y el resultado sea devuelto en la interfaz.
*/


function calcularPrecioFinal(descuento, precioCurso, modalidad){
    precioDescuento = precioCurso - precioCurso * descuento
    switch(modalidad){
        case "semi":
            precioFinal = precioDescuento - precioDescuento * 0.1
            break
        case "online":
            precioFinal = precioDescuento- precioDescuento * 0.2
            break
    }
    return precioFinal
}


function puedeAcceder(edad, bloqueado, tieneMatricula){
    if (edad >= 18){
        switch(tieneMatricula){
            case false:
                break
            case true:
                switch(bloqueado){
                    case true:
                        acceso = false
                    case false:
                        acceso = true
                }

        }
    }
    return acceso
}


function obtenerCalificacion(nota){
    if (nota < 0 || nota > 10){
        calificacion = "Nota no valida"
    }
    else if(nota < 5){
        calificacion = "Suspenso"
    }
    else if (nota < 6){
        calificacion = "Aprobado"
    }
    else if (nota < 7){
        calificacion = "Bien"
    }
    else if (nota <= 9){
        calificacion = "Notable"
    }
    else{
        calificacion = "Sobresaliente"
    }

    return calificacion
}


function main(){

    let nombre = "Juan"
    let edad = 2
    let precioCurso = 100
    let descuento = 0.1
    let bloqueado = false
    let tieneMatricula = true
    let nota = 7
    let modalidad = "semi" //presencial, semi, online

    console.log(nombre)
    precio = calcularPrecioFinal(descuento, precioCurso, modalidad)
    console.log(precio)
    acceso = puedeAcceder(edad, bloqueado, tieneMatricula)
    if(acceso === true){
        console.log("Tiene acceso")
    }
    else{
        console.log("NO tiene acceso")
    }
    calificacion = obtenerCalificacion(nota)
    console.log(calificacion)
}

main()